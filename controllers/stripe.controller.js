// Stripe details
const publishableKey = process.env.PUBLISHABLE_KEY;
const secretKey = process.env.SECRET_KEY;
const stripe = require('stripe')(secretKey);
const { v4: uuid } = require('uuid');
const Users = require('@models/user.model');
const Plans = require('@models/plans.model');
const PlanGroups = require('@models/planGroups.model');
const sendMail = require('@utils/sendMail');
const { addRemainingHours } = require('../utils/users');

const createCustomer = async (user) => {
  const customer = await stripe.customers.create({
    name: user.name,
    email: user.email,
    phone: user.contact,
    address: {
      line1: user.address,
      city: user.city,
      postal_code: user.pinCode,
      state: user.state,
      country: user.country,
    },
    metadata: {
      mongoId: `${user._id}`,
    },
  });
  return customer;
};

const createPaymentObject = (charge) => {
  return {
    stripeIntentId: charge.payment_intent,
    stripeChargeId: charge.id,
    amount: charge.amount,
    description: JSON.parse(charge.metadata.mongoPlan).name,
    currency: charge.currency,
    createdAt: charge.created * 1000,
    receiptUrl: charge.receipt_url,
    status: charge.status,
  };
};

exports.createPaymentIntent = async (req, res) => {
  const { userId, planId } = req.body;
  const userPromise = Users.findById(userId);
  const planPromise = Plans.findById(planId);
  const [user, plan] = await Promise.all([userPromise, planPromise]);
  if (!user || !plan) {
    return res.json({
      status: 404,
      error: true,
      message: 'Plan or User not found',
    });
  }
  if (plan.name === 'Free Tier') {
    return res.json({
      status: 400,
      error: true,
      message: 'You cannot purchase Free Tier',
    });
  }
  try {
    if (!user.stripeId) {
      const customer = await createCustomer(user);
      user.stripeId = customer.id;
      user.save();
    }
    const planPrice = await stripe.prices.retrieve(plan.stripePriceId);
    const paymentIntent = await stripe.paymentIntents.create({
      customer: user.stripeId,
      receipt_email: user.email,
      setup_future_usage: 'off_session',
      amount: planPrice.unit_amount,
      currency: planPrice.currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        mongoUserId: `${user._id}`,
        mongoPlan: JSON.stringify({
          id: plan._id,
          planUid: plan.planUid,
          groupUid: plan.planUid > 1 ? uuid() : '',
          name: plan.name,
          type: 'purchased',
          assignedBy: '',
          licenseCount: plan.licenseCount - 1,
          assigned: 0,
          assignee: [],
          expiresAt: new Date(new Date().setDate(new Date().getDate() + plan.expiresIn)).toString(),
        }),
        userSettings: JSON.stringify({
          waitingRoom: plan.waitingRoom,
          screenShare: true,
          chat: true,
          limit: plan.participantCapacity,
        }),
      },
    });
    res.json({
      status: 200,
      error: false,
      message: 'Payment Intent created successfully',
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.log(err);
    res.json({ code: 400, error: true, message: err });
  }
};

exports.userStatus = async (req, res) => {
  const { userId } = req.query;
  let user = await Users.findById(userId);
  const paymentIntent = await stripe.paymentIntents.retrieve(user.lastPaymentIntendId);
  if (paymentIntent.status !== 'succeeded') {
    return res.json({
      code: 400,
      error: true,
      message: `Payment ${paymentIntent.status}`,
      user,
    });
  }
  user = await addRemainingHours(user);
  res.json({
    code: 200,
    error: false,
    message: 'User status with last payment receipt fetched',
    receipt: paymentIntent.charges.data[0].receipt_url,
    user,
  });
};

exports.paymentMethod = async (req, res) => {
  const { userId, card } = req.body;
  const { name, number, exp_month, exp_year, cvc, address_country = '', address_zip = '' } = card;
  if (!number || !exp_month || !exp_year || !cvc) {
    return res.json({
      code: 400,
      error: true,
      message: 'Please provide all necessary details to save the card',
    });
  }
  let user = await Users.findById(userId);
  if (!user.stripeId) {
    const customer = await createCustomer(user);
    user.stripeId = customer.id;
    user.save();
  }
  try {
    const cardToken = await stripe.tokens.create({
      card: {
        name,
        number,
        exp_month,
        exp_year,
        cvc,
        address_country,
        address_zip,
      },
    });
    const stripeCard = await stripe.customers.createSource(user.stripeId, {
      source: `${cardToken.id}`,
      metadata: { mongoId: `${user._id}` },
    });
    const Card = {
      stripeId: stripeCard.id,
      name: stripeCard.name || user.name,
      number,
      exp_month: stripeCard.exp_month,
      exp_year: stripeCard.exp_year,
      brand: stripeCard.brand,
      type: stripeCard.funding,
      fingerprint: stripeCard.fingerprint,
    };
    user.cards.push(Card);
    user.save();
    user = await addRemainingHours(user);
    res.json({
      code: 200,
      error: false,
      message: 'Card added successfully',
      user,
    });
  } catch (err) {
    console.log('Add Payment Method Error', err);
    res.json({ status: 500, error: true, message: err });
  }
};

exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.ENDPOINT_SECRET;
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.log(err);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  let paymentIntent, mongoUserId, mongoPlan, paymentObject, user;

  switch (event.type) {
    case 'payment_intent.created':
      paymentIntent = event.data.object;
      mongoUserId = paymentIntent.metadata.mongoUserId;
      await Users.findByIdAndUpdate(mongoUserId, {
        lastPaymentIntendId: paymentIntent.id,
      });
      break;
    case 'payment_intent.succeeded':
      paymentIntent = event.data.object;
      [mongoUserId, mongoPlan, paymentObject, userSettings] = [
        paymentIntent.metadata.mongoUserId,
        JSON.parse(paymentIntent.metadata.mongoPlan),
        createPaymentObject(paymentIntent.charges.data[0]),
        JSON.parse(paymentIntent.metadata.userSettings),
      ];
      const planPromise = Plans.findById(mongoPlan.id);
      user = await Users.findByIdAndUpdate(
        mongoUserId,
        {
          settings: userSettings,
          plan: { ...mongoPlan, expiresAt: new Date(mongoPlan.expiresAt) },
          lastPaymentIntendId: paymentIntent.id,
          $push: { paymentHistory: paymentObject },
        },
        { new: true }
      );
      const plan = await Promise.resolve(planPromise);
      PlanGroups.create({
        uid: mongoPlan.groupUid,
        leftHours: plan.noOfMeetingHours,
        totalHours: plan.noOfMeetingHours,
        users: [{ id: user.id, name: user.name, email: user.email }],
      });
      sendMail('../views/successPayment.handlebars', user.email, '[Monet Live] Payment successful & plan upgraded', {
        Name: user.name,
        Plan: mongoPlan.name,
        Link: paymentIntent.charges.data[0].receipt_url,
      });
      break;
    case 'payment_intent.payment_failed':
      paymentIntent = event.data.object;
      [mongoUserId, mongoPlan, paymentObject] = [
        paymentIntent.metadata.mongoUserId,
        JSON.parse(paymentIntent.metadata.mongoPlan),
        createPaymentObject(paymentIntent.charges.data[0]),
      ];
      const message = paymentIntent.last_payment_error && paymentIntent.last_payment_error.message;
      console.log('Failed:', paymentIntent.id, message);
      user = await Users.findByIdAndUpdate(mongoUserId, { $push: { paymentHistory: paymentObject } }, { new: true });
      sendMail(
        '../views/failedPayment.handlebars',
        user.email,
        '[Monet Live] Payment failed & plan could not be upgraded',
        {
          Name: user.name,
          Message: message,
        }
      );
      break;
    default:
  }

  res.send('Done');
};
