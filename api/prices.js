const TIERS = require('./_tiers');

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(
    Object.fromEntries(
      Object.entries(TIERS).map(([k, t]) => [k, { name: t.name, price: t.price }])
    )
  );
};
