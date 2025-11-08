import { Router } from 'express';
import * as payrollController from './payroll.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requireHR } from '../../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Generate payrun (HR/admin only)
router.post('/generate', requireHR, payrollController.generatePayrunController);

// Get payruns
router.get('/payruns', payrollController.getPayrunsController);

// Finalize payrun (HR/admin only)
router.post('/:payrunId/finalize', requireHR, payrollController.finalizePayrunController);

// Get payslips by payrun
router.get('/:payrunId/payslips', payrollController.getPayslipsByPayrunIdController);

// Get payslip by ID
router.get('/payslip/:id', payrollController.getPayslipByIdController);

export default router;


