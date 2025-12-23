module.exports = async (req, res, next) => {
  const user = await req.db.users.findOne({ email: req.user.email });
  if (user?.role !== "staff") {
    return res.status(403).send({ message: "Staff only" });
  }
  next();
};
