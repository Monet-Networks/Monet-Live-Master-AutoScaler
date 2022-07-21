const { Router } = require('express');
const ReportRouter = Router();

ReportRouter.get('/:id', (req,res) => {
  res.json({
    id: req.params.id,
  });
})

module.exports = ReportRouter;