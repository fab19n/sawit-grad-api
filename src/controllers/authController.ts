import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { AuthRequest } from '../types';

function signToken(payload: {
  id: string;
  email: string;
  role: string;
  millId: string;
}): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as object);
}

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email dan kata laluan diperlukan.',
      });
      return;
    }

    // We use .select('+password') to explicitly include the password
    // hash field that is normally hidden by select: false in the schema.
    // Without this, the password field would be undefined and bcrypt.compare
    // would always return false regardless of what the user types.
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !user.isActive) {
      // Deliberately vague message — we don't want to reveal
      // whether the email exists in the system or not, as that
      // would allow enumeration of valid accounts
      res.status(401).json({
        success: false,
        message: 'Email atau kata laluan tidak sah.',
      });
      return;
    }

    // Compare the plain text password from the request against
    // the bcrypt hash stored in the database
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Email atau kata laluan tidak sah.',
      });
      return;
    }

    // Update the audit trail — knowing when each user last logged in
    // is useful for the manager dashboard later
    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken({
      id:     user._id.toString(),
      email:  user.email,
      role:   user.role,
      millId: user.millId.toString(),
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id:     user._id,
        name:   user.name,
        email:  user.email,
        role:   user.role,
        millId: user.millId,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Ralat pelayan.' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).populate('millId', 'name code');

    if (!user) {
      res.status(404).json({ success: false, message: 'Pengguna tidak dijumpai.' });
      return;
    }

    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Ralat pelayan.' });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, millId } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ success: false, message: 'Email telah didaftarkan.' });
      return;
    }

    // Hash the password here explicitly — 12 salt rounds is the
    // current security best practice, balancing security vs performance.
    // Each additional round doubles the computation time — 12 rounds
    // takes ~300ms on a modern server, which is imperceptible to a
    // human but makes brute-force attacks computationally expensive.
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role:   role   || 'grader',
      millId,
    });

    res.status(201).json({
      success: true,
      user: {
        id:     user._id,
        name:   user.name,
        email:  user.email,
        role:   user.role,
        millId: user.millId,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Ralat pendaftaran.' });
  }
};