const dashboard = require('../services/dashboardService');

exports.get = async (req, res) =>
  res.json({ success: true, data: await dashboard(req.user._id) });
