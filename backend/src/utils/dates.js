const TZ = process.env.CAMPUS_TIMEZONE || 'Asia/Kolkata';

exports.DAY = 86400000;
exports.today = () => new Date(`${new Date().toLocaleDateString('en-CA', { timeZone: TZ })}T00:00:00Z`);
exports.dayCount = (start, end) => (end - start) / exports.DAY + 1;
