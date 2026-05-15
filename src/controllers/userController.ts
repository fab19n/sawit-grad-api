import { Response } from 'express';
import User from '../models/User';
import { AuthRequest } from '../types';

// GET /api/users — list all users in the same mill
// Accessible by manager and admin roles only (enforced in route)
export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const millId = req.user!.millId;

    const users = await User.find({ millId })
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, users });
  } catch (err) {
    console.error('getUsers error:', err);
    res.status(500).json({ success: false, message: 'Ralat pelayan.' });
  }
};

// PATCH /api/users/:id/toggle — flip isActive for a user
// Admin only — a manager cannot deactivate other managers
export const toggleUserActive = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const millId      = req.user!.millId;
    const requestorId = req.user!.id;

    // Prevent self-deactivation
    if (id === requestorId) {
      res.status(400).json({ success: false, message: 'Anda tidak boleh nyahaktifkan akaun sendiri.' });
      return;
    }

    const user = await User.findOne({ _id: id, millId });
    if (!user) {
      res.status(404).json({ success: false, message: 'Pengguna tidak dijumpai.' });
      return;
    }

    // Only admin can toggle other admins/managers
    if (user.role !== 'grader' && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Hanya admin boleh mengubah status pengurus.' });
      return;
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      user: {
        id:       user._id,
        name:     user.name,
        email:    user.email,
        role:     user.role,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    console.error('toggleUserActive error:', err);
    res.status(500).json({ success: false, message: 'Ralat pelayan.' });
  }
};
