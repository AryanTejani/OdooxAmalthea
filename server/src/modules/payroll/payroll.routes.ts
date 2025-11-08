import { Router } from 'express';
import * as payrollController from './payroll.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePayrollOfficer } from '../../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// All payroll routes require Payroll Officer or Admin
// Employees and HR Officers cannot access payroll
router.use(requirePayrollOfficer);

// Generate payrun (Payroll Officer/Admin only)
router.post('/generate', payrollController.generatePayrunController);

// Get payruns (Payroll Officer/Admin only)
router.get('/payruns', payrollController.getPayrunsController);

// Finalize payrun (Payroll Officer/Admin only)
router.post('/:payrunId/finalize', payrollController.finalizePayrunController);

// Get payslips by payrun (Payroll Officer/Admin only)
router.get('/:payrunId/payslips', payrollController.getPayslipsByPayrunIdController);

// Get payslip by ID (Payroll Officer/Admin only)
router.get('/payslip/:id', payrollController.getPayslipByIdController);

export default router;


