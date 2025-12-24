module.exports = async (req, res, next) => {
  try {
    const user = await req.db.users.findOne({ email: req.user.email });
    if (!user || user.role !== "user") {
      return res.status(403).send({ message: "User only route" });
    }
    next();
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
};
