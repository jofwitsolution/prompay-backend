const crypto = require("crypto");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const Assessment = require("../models/Assessment");
const Subject = require("../models/Subject");
const { sendCode } = require("../nodemailer/verificationMessage");
const generateCode = require("../utils/generateCode");
const { generateToken } = require("../utils/generateToken");
const {
  validateUserProfile,
  validateUserSignup,
  validateEmail,
  adminValidateUserProfile,
  validatePassword,
  validateUserBirthDay,
} = require("../validations/userValidation");
const {
  sendSuccessfulVerificationMessage,
} = require("../nodemailer/successfulVerification");
const { sendPasswordToken } = require("../nodemailer/password-reset-message");
const {
  sendSuccessfulPasswordMessage,
} = require("../nodemailer/successful-password-message");

// @desc Signup user
// @route Post /api/users/signup
// @Access Public
const signupUser = async (req, res, next) => {
  try {
    // Validation
    const { error } = validateUserSignup(req.body);
    if (error) {
      // if it is the regex pattern
      if (error.details[0].context?.regex) {
        return res.status(400).json({
          message:
            "Password must contain at least one uppercase, lowercase, number and special character",
        });
      }

      return res.status(400).json({ message: error.details[0].message });
    }

    let {
      firstName,
      lastName,
      email,
      phone,
      location,
      birthDay,
      gender,
      password,
    } = req.body;

    // validate birth day
    const isUnderAge = validateUserBirthDay(birthDay);
    if (isUnderAge) {
      return res.status(400).json({ message: isUnderAge });
    }

    email = email.toLowerCase();
    // check if a user with the same email already exists
    let existingUser = await User.findOne({ email: email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exist" });
    }

    // check if a user with the same phone number already exists
    existingUser = await User.findOne({ phone: phone });
    if (existingUser) {
      return res.status(400).json({ message: "Phone number taken" });
    }

    // hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // generate the verification code (4 digits)
    const verificationCode = generateCode();
    const verificationCodeExpiration = Date.now() + 300000; // current time + 5m (300,000ms)

    // create a new user
    const user = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      location,
      birthDay,
      gender,
      verificationCode,
      verificationCodeExpiration,
    });

    await user.save();

    sendCode({
      firstName,
      lastName,
      email,
      verificationCode,
      verificationCodeExpiration: "5 minutes",
    });

    res.status(201).json({
      message: "Verification code sent successfully",
      email,
      verificationCodeExpiration: 300000, // 300,000ms = '5 minutes'
    });
  } catch (error) {
    next(error);
  }
};

// @desc Resend user verification code
// @route Post /api/users/resend-verification-code
// @Access Public
const resendVerificationCode = async (req, res, next) => {
  try {
    const { error } = validateEmail(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // generate the verification code (4 digits)
    const verificationCode = generateCode();
    const verificationCodeExpiration = Date.now() + 300000; // current time + 5m (300,000ms)

    user.verificationCode = verificationCode;
    user.verificationCodeExpiration = verificationCodeExpiration;
    await user.save();

    sendCode({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      verificationCode,
      verificationCodeExpiration: "5 minutes",
    });

    res.status(201).json({
      message: "Verification code sent successfully",
      email: user.email,
      verificationCodeExpiration: 300000, // 300,000ms = '5 minutes'
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @desc Verify user code
// @route Post /api/users/verify-code
// @Access Public
const verifyCode = async (req, res, next) => {
  try {
    const email = req.body.email;
    const { error } = validateEmail({ email });
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const user = await User.findOne({
      email: email,
      verificationCode: req.body.verificationCode,
      verificationCodeExpiration: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid code. Click resend below." });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiration = undefined;

    await user.save();

    sendSuccessfulVerificationMessage({
      lastName: user.lastName,
      email: user.email,
    });

    res.json({ message: "Verification successful." });
  } catch (err) {
    next(err);
  }
};

// @desc Get user profile
// @route GET /api/users/:id/profile
// @access Private
const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      "firstName lastName email phone location role isAdmin birthDay imageUrl isVerified gender createdAt updatedAt"
    );

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    next(err);
  }
};

// @desc Update user profile
// @route Patch /api/users/:id/profile
// @access Private
const updateUserProfile = async (req, res, next) => {
  try {
    const { error } = validateUserProfile(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const user = await User.findById(req.params.id);

    if (user) {
      user.firstName = req.body.firstName;
      user.lastName = req.body.lastName;
      user.location = req.body.location;

      const updatedUser = await user.save();

      const token = generateToken(
        updatedUser._id,
        updatedUser.firstName,
        updatedUser.lastName,
        updatedUser.role,
        updatedUser.isAdmin
      );

      res.json({
        _id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phone,
        gender: updatedUser.gender,
        isAdmin: updatedUser.isAdmin,
        location: updatedUser.location,
        imageUrl: updatedUser.imageUrl,
        birthDay: updatedUser.birthDay,
        isVerified: updatedUser.isVerified,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
        token: token,
      });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    next(error);
  }
};

// @desc Get user dashboard
// @route GET /api/users/:id/dashboard
// @access Private
const getUserDashboard = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -hasAuthority -__v -isAdmin -currentAssessment")
      .populate("assessments");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const scoreInSubject = {};

    // find all subject and initialize score to zero for all subjects
    const subjects = await Subject.find({}).select(
      "_id score title description"
    );
    for (const subject of subjects) {
      scoreInSubject[subject._id] = 0;
    }

    // check correct score for each subject then add the score
    for (const assessment of user.assessments) {
      for (const answer of assessment.answers) {
        if (answer.correct) {
          scoreInSubject[answer.subject] = scoreInSubject[answer.subject] + 1;
        }
      }
    }

    // record the score for each subject in subjects array
    for (const subject of subjects) {
      subject.score = scoreInSubject[subject._id];
      // console.log(scoreInSubject[subject._id]);
    }

    user.assessments = user.assessments.length;
    res.json({
      subjects: subjects,
      assessmentsTaken: user.assessments.length,
      wallet: user.wallet,
      totalScore: user.totalScore,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (err) {
    next(err);
  }
};

// @desc Get user wallet information
// @route GET /api/users/:id/wallet
// @access Private
const getUserWallet = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -hasAuthority -isAdmin")
      .populate(["transactions", "payments"]);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      wallet: user.wallet,
      transactions: user.transactions,
      payments: user.payments,
    });
  } catch (err) {
    next(err);
  }
};

// @desc Get all users
// @route GET /api/users?pageSize=10&pageNumber=1
// @access Private/Admin
const getUsers = async (req, res, next) => {
  try {
    // const pageSize = Number(req.query.pageSize) || 10;
    // const page = Number(req.query.pageNumber) || 1;

    // const count = await User.countDocuments({});
    // const users = await User.find({})
    //   .select('-password -__v')
    //   .limit(pageSize)
    //   .skip(pageSize * (page - 1));

    // res.json({
    //   users,
    //   page,
    //   pages: Math.ceil(count / pageSize),
    // });

    const users = await User.find({}).select("-password -__v");

    res.json(users);
  } catch (error) {
    next(error);
  }
};

// @desc Delete user
// @route DELETE /api/users/:id/delete
// @access Private/Admin
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      await user.remove();
      res.json({ message: "User successfuly removed" });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    next(error);
  }
};

// @desc Admin get user by ID
// @route GET /api/users/:id
// @access Private/Admin
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password -__v");

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    next(error);
  }
};

// @desc Admin update user by ID
// @route Patch /api/users/:id
// @access Private/Admin
const updateUserById = async (req, res, next) => {
  try {
    const { error } = adminValidateUserProfile(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const user = await User.findById(req.params.id);

    if (user) {
      user.firstName = req.body.firstName;
      user.lastName = req.body.lastName;
      user.role = req.body.role;
      user.isAdmin = req.body.isAdmin;
      user.hasAuthority = req.body.hasAuthority;
      user.gender = req.body.gender;
      user.location = req.body.location;

      const updatedUser = await user.save();
      updatedUser.password = undefined;

      res.json(updatedUser);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    next(err);
  }
};

// @desc Reset Password
// @route POST /api/users/reset-password
// @access Public
const resetPassword = async (req, res) => {
  try {
    crypto.pseudoRandomBytes(32, async (err, buffer) => {
      if (err) {
        return res.status(400).json({ message: "Bad request" });
      }
      const token = buffer.toString("hex");
      // console.log(token);
      const email = req.body.email;
      let user = await User.findOne({ email });

      if (!user) {
        return res
          .status(404)
          .json({ message: "User with the given email does not exist." });
      }

      user.resetToken = token;
      user.resetTokenExpiration = Date.now() + 300000; //current time + 5min(300000ms)
      user = await user.save();

      sendPasswordToken({ email, token });

      res.json({
        message: "A link to change password has been sent to your email.",
      });
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @desc Verify password token
// @route GET /api/users/verify-password-token/:token
// @access Public
const verifyPasswordToken = async (req, res) => {
  const token = req.params.token;

  const user = await User.findOne({
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() },
  });

  if (!user) {
    return res
      .status(400)
      .json({ message: "Token expired. Make new request." });
  }

  res.json({
    userId: user._id.toString(),
    passwordToken: token,
  });
};

// @desc Set New Password
// @route POST /api/users/new-password
// @access Public
const setNewPassword = async (req, res) => {
  const { userId, passwordToken, password } = req.body;

  const { error } = validatePassword({ password });
  if (error) {
    // if it is the regex pattern
    if (error.details[0].context?.regex) {
      return res.status(400).json({
        message:
          "Password must contain at least one uppercase, lowercase, number and special character",
      });
    }

    return res.status(400).json({ message: error.details[0].message });
  }

  const user = await User.findOne({
    resetToken: passwordToken,
    resetTokenExpiration: { $gt: Date.now() },
    _id: userId,
  });

  if (!user) {
    return res
      .status(400)
      .json({ message: "Token expired. Make new request." });
  }

  // hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  user.password = hashedPassword;
  user.resetToken = undefined;
  user.resetTokenExpiration = undefined;

  await user.save();

  sendSuccessfulPasswordMessage({
    email: user.email,
    lastName: user.lastName,
  });

  res.json({
    message: "Password changed successfully.",
  });
};

module.exports.signupUser = signupUser;
module.exports.resendVerificationCode = resendVerificationCode;
module.exports.verifyCode = verifyCode;
module.exports.getUserProfile = getUserProfile;
module.exports.updateUserProfile = updateUserProfile;
module.exports.getUserDashboard = getUserDashboard;
module.exports.getUserWallet = getUserWallet;
module.exports.getUsers = getUsers;
module.exports.deleteUser = deleteUser;
module.exports.getUserById = getUserById;
module.exports.updateUserById = updateUserById;
module.exports.resetPassword = resetPassword;
module.exports.verifyPasswordToken = verifyPasswordToken;
module.exports.setNewPassword = setNewPassword;
