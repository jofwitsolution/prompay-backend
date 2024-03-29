const Withdrawal = require("../models/Withdrawal");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const Setting = require("../models/Setting");
const {
  validateWithdrawal,
  validateWithdrawalAction,
} = require("../validations/withdrawalValidation");
const { conn } = require("../db");
const {
  sendSuccessfulWithdrawalMessage,
} = require("../nodemailer/successfulWithdrawal");
const {
  sendWithdrawalRequestMessage,
} = require("../nodemailer/withdrawalRequest");

// @desc Withdraw earned money
// @route POST /api/withdrawals
// @access Private
const withdrawal = async (req, res, next) => {
  const session = await conn.startSession();

  try {
    session.startTransaction();

    const { error } = validateWithdrawal(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    // Get assessment settings
    const settings = await Setting.findOne({
      setting: "withdrawal settings",
    });
    if (!settings) {
      return res.status(403).json({
        message: "Settings error.",
      });
    }

    const minWithdrawal = parseInt(settings.data.minWithdrawal) || 200;
    const maxWithdrawal = parseInt(settings.data.maxWithdrawal) || 50000;

    if (req.body.amount < minWithdrawal) {
      return res.status(400).json({
        message: `The minimum withdrawal is ${minWithdrawal}`,
      });
    }
    if (req.body.amount > maxWithdrawal) {
      return res.status(400).json({
        message: `The maximum withdrawal is ${maxWithdrawal}`,
      });
    }

    const userId = req.user._id;
    const user = await User.findById(userId).session(session);
    // check if user have less than the withdrawal amount
    if (user.wallet < req.body.amount) {
      return res.status(400).json({ message: "Not enough balance" });
    }
    // deduct the amount
    user.wallet -= req.body.amount;

    // record the transaction
    const transaction = new Transaction({
      user: userId,
      amount: req.body.amount,
      type: "withdrawal",
      status: "pending",
    });
    await transaction.save({ session });

    user.transactions.push(transaction._id);
    await user.save({ session });

    //record the withdrawal info
    const withdrawal = new Withdrawal({
      user: userId,
      type: req.body.type,
      bankName: req.body.bankName,
      accountNumber: req.body.accountNumber,
      accountName: req.body.accountName,
      amount: req.body.amount,
      status: "pending",
      transaction: transaction._id,
    });
    await withdrawal.save({ session });

    await session.commitTransaction();

    sendWithdrawalRequestMessage({
      firstName: user.firstName,
      lastName: user.lastName,
      amount: transaction.amount,
      transactionId: transaction._id,
      withdrawalId: withdrawal._id,
    });

    res.status(201).json({
      message: "Withdrawal pending",
      withdrawal: withdrawal,
    });
  } catch (err) {
    console.error(err);
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

// @desc Admin process withdrawal
// @route PATCH /api/withdrawals/:id/process
// @access Private/Admin
const processWithdrawal = async (req, res, next) => {
  const session = await conn.startSession();

  try {
    session.startTransaction();

    const { error } = validateWithdrawalAction(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const withdrawal = await Withdrawal.findById(req.params.id).session(
      session
    );
    if (!withdrawal) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }
    if (withdrawal.status === "successful") {
      return res.status(400).json({ message: "Withdrawal already processed" });
    }
    withdrawal.status = req.body.action;
    await withdrawal.save({ session });

    const transaction = await Transaction.findById(withdrawal.transaction)
      .populate("user")
      .session(session);
    transaction.status = req.body.action;
    await transaction.save({ session });

    await session.commitTransaction();

    sendSuccessfulWithdrawalMessage({
      lastName: transaction.user.lastName,
      email: transaction.user.email,
      wallet: transaction.user.wallet,
      amount: transaction.amount,
      transactionId: transaction._id,
      withdrawalId: withdrawal._id,
    });

    res.status(200).json({
      message: "Withdrawal completed",
      withdrawal: withdrawal,
    });
  } catch (err) {
    console.error(err);
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

// @desc Admin get withdrawals
// @route GET /api/withdrawals?status=successfull
// @access Private/Admin
const getWithdrawals = async (req, res, next) => {
  try {
    const query = req.query.status
      ? {
          status: req.query.status,
        }
      : {};
    const withdrawals = await Withdrawal.find(query).sort({ createdAt: 1 });

    res.json(withdrawals);
  } catch (err) {
    next(err);
  }
};

// @desc Admin get withdrawal
// @route GET /api/withdrawals/:id
// @access Private/Admin
const getWithdrawalById = async (req, res, next) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id).populate({
      path: "user",
      select:
        "firstName isVerified lastName email phone _id totalScore wallet location imageUrl createdAt",
    });
    if (!withdrawal) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    res.json(withdrawal);
  } catch (err) {
    next(err);
  }
};

module.exports.withdrawal = withdrawal;
module.exports.processWithdrawal = processWithdrawal;
module.exports.getWithdrawals = getWithdrawals;
module.exports.getWithdrawalById = getWithdrawalById;
