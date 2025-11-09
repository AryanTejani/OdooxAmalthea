import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { useBrand } from '@/context/BrandContext';
import { authApi, hrmsApi, companyApi, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { FormFooter } from '@/components/ui-ext/FormFooter';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Edit2, X, Plus, Save, Building2, CreditCard, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function Profile() {
  const { user: authUser, refreshUser } = useAuth();
  const { company, refreshCompany } = useBrand();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('resume');
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');

  // Get user profile with employee info
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', 'profile'],
    queryFn: () => authApi.getMe(),
    enabled: !!authUser,
  });

  // Role-based access control (memoized to prevent unnecessary re-renders)
  const isAdminOrPayroll = useMemo(() => {
    return user ? (user.role === 'admin' || user.role === 'payroll') : false;
  }, [user]);
  
  const isEmployeeOrHR = useMemo(() => {
    return user ? (user.role === 'employee' || user.role === 'hr') : false;
  }, [user]);
  
  const canViewSalary = useMemo(() => {
    return user ? (isAdminOrPayroll || isEmployeeOrHR) : false;
  }, [user, isAdminOrPayroll, isEmployeeOrHR]);
  
  const canEditSalary = isAdminOrPayroll;
  
  // For admin/payroll: selected employee ID (default to own employee if exists)
  // For employees/HR: always use own employee ID
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [editingSalary, setEditingSalary] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  
  // Salary edit form state
  const [editBasic, setEditBasic] = useState<number>(0);
  const [editHRA, setEditHRA] = useState<number>(0);
  const [editStandardAllowance, setEditStandardAllowance] = useState<number>(0);
  const [editPerformanceBonus, setEditPerformanceBonus] = useState<number>(0);
  const [editLTA, setEditLTA] = useState<number>(0);
  const [editFixedAllowance, setEditFixedAllowance] = useState<number>(0);
  
  // Get employees list for admin/payroll to select from
  const { data: employees, isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => hrmsApi.getAllEmployees(),
    enabled: !!isAdminOrPayroll,
  });
  
  // Determine which employee ID to use for salary query
  const employeeIdForSalary = useMemo(() => {
    if (isEmployeeOrHR) {
      // Employees/HR can only see their own salary
      return user?.employee?.id || null;
    } else if (isAdminOrPayroll) {
      // Admin/Payroll can select any employee
      // Default to selected employee, or own employee, or first employee in list
      if (selectedEmployeeId) {
        return selectedEmployeeId;
      }
      if (user?.employee?.id) {
        return user.employee.id;
      }
      if (employees && employees.length > 0) {
        return employees[0].id;
      }
      return null;
    }
    return null;
  }, [user, selectedEmployeeId, isAdminOrPayroll, isEmployeeOrHR, employees]);
  
  // Get salary configuration
  const { data: salaryConfig, isLoading: isLoadingSalaryConfig } = useQuery({
    queryKey: ['employee', 'salary-config', employeeIdForSalary],
    queryFn: () => hrmsApi.getSalaryConfiguration(employeeIdForSalary!),
    enabled: !!canViewSalary && !!employeeIdForSalary,
  });
  
  // Update edit form when salary config loads or when entering edit mode
  useEffect(() => {
    if (salaryConfig) {
      setEditBasic(salaryConfig.basic || 0);
      setEditHRA(salaryConfig.allowances?.hra || 0);
      setEditStandardAllowance(salaryConfig.allowances?.standardAllowance || 0);
      setEditPerformanceBonus(salaryConfig.allowances?.performanceBonus || 0);
      setEditLTA(salaryConfig.allowances?.lta || 0);
      setEditFixedAllowance(salaryConfig.allowances?.fixedAllowance || 0);
    }
  }, [salaryConfig]);
  
  // Initialize selectedEmployeeId for admin/payroll when employees load
  useEffect(() => {
    if (isAdminOrPayroll && employees && employees.length > 0 && !selectedEmployeeId) {
      // Default to user's own employee if exists, otherwise first employee
      const defaultEmployeeId = user?.employee?.id || employees[0]?.id;
      if (defaultEmployeeId) {
        setSelectedEmployeeId(defaultEmployeeId);
      }
    }
  }, [isAdminOrPayroll, employees, user, selectedEmployeeId]);

  // Salary update mutation (must be before early returns per Rules of Hooks)
  const updateSalaryMutation = useMutation({
    mutationFn: async (data: { employeeId: string; basic: number; allowances: Record<string, number> }) => {
      return hrmsApi.updateSalaryConfig(data.employeeId, {
        basic: data.basic,
        allowances: data.allowances,
      });
    },
    onSuccess: (_, variables) => {
      // Use the employeeId from the mutation variables to invalidate the correct query
      queryClient.invalidateQueries({ queryKey: ['employee', 'salary-config', variables.employeeId] });
      toast.success('Salary configuration updated successfully');
      setEditingSalary(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  // Salary delete mutation
  const deleteSalaryMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      return hrmsApi.deleteSalaryConfig(employeeId);
    },
    onSuccess: (_, employeeId) => {
      queryClient.invalidateQueries({ queryKey: ['employee', 'salary-config', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Salary configuration deleted successfully');
      // Reset to first employee or null if no employees
      if (employees && employees.length > 0) {
        setSelectedEmployeeId(employees[0].id);
      } else {
        setSelectedEmployeeId(null);
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  // Resume tab state
  const [about, setAbout] = useState('');
  const [jobLove, setJobLove] = useState('');
  const [hobbies, setHobbies] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [newCertification, setNewCertification] = useState('');

  // Private info tab state
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [manager, setManager] = useState('');
  const [location, setLocation] = useState('');
  const [userCompany, setUserCompany] = useState(''); // User's company field (text), not the Company entity

  // Security tab state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Sync state when user data loads
  useEffect(() => {
    if (user) {
      setAbout(user.about || '');
      setJobLove(user.jobLove || '');
      setHobbies(user.hobbies || '');
      setSkills(user.skills || []);
      setCertifications(user.certifications || []);
      setPhone(user.phone || '');
      setDepartment(user.department || '');
      setManager(user.manager || '');
      setLocation(user.location || '');
      setUserCompany(user.company || '');
    }
  }, [user]);

  // Initialize company form data (must be before any conditional returns)
  useEffect(() => {
    if (company) {
      setCompanyName(company.name);
      setCompanyLogoUrl(company.logoUrl || '');
    }
  }, [company]);

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['user', 'profile'], updatedUser);
      refreshUser();
      toast.success('Profile updated successfully');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['user', 'profile'], updatedUser);
      refreshUser();
      toast.success('Password changed successfully');
      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleSaveResume = () => {
    updateProfileMutation.mutate({
      about: about || undefined,
      jobLove: jobLove || undefined,
      hobbies: hobbies || undefined,
      skills: skills.length > 0 ? skills : undefined,
      certifications: certifications.length > 0 ? certifications : undefined,
    });
  };

  const handleSavePrivateInfo = () => {
    updateProfileMutation.mutate({
      phone: phone || undefined,
      department: department || undefined,
      manager: manager || undefined,
      location: location || undefined,
      company: userCompany || undefined,
    });
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter(s => s !== skill));
  };

  const handleAddCertification = () => {
    if (newCertification.trim() && !certifications.includes(newCertification.trim())) {
      setCertifications([...certifications, newCertification.trim()]);
      setNewCertification('');
    }
  };

  const handleRemoveCertification = (cert: string) => {
    setCertifications(certifications.filter(c => c !== cert));
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
      confirmPassword,
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Handler functions (defined after hooks but before render)
  const handleSaveSalary = () => {
    if (!employeeIdForSalary) {
      toast.error('No employee selected');
      return;
    }
    
    const allowances: Record<string, number> = {};
    if (editHRA > 0) allowances.hra = editHRA;
    if (editStandardAllowance > 0) allowances.standardAllowance = editStandardAllowance;
    if (editPerformanceBonus > 0) allowances.performanceBonus = editPerformanceBonus;
    if (editLTA > 0) allowances.lta = editLTA;
    if (editFixedAllowance > 0) allowances.fixedAllowance = editFixedAllowance;
    
    updateSalaryMutation.mutate({
      employeeId: employeeIdForSalary,
      basic: editBasic,
      allowances,
    });
  };
  
  const handleCancelEditSalary = () => {
    setEditingSalary(false);
    // Reset form to original values
    if (salaryConfig) {
      setEditBasic(salaryConfig.basic || 0);
      setEditHRA(salaryConfig.allowances?.hra || 0);
      setEditStandardAllowance(salaryConfig.allowances?.standardAllowance || 0);
      setEditPerformanceBonus(salaryConfig.allowances?.performanceBonus || 0);
      setEditLTA(salaryConfig.allowances?.lta || 0);
      setEditFixedAllowance(salaryConfig.allowances?.fixedAllowance || 0);
    }
  };
  
  // After the check above, user is guaranteed to be defined
  const showSalaryTab = canViewSalary;
  const showCompanyTab = user?.role === 'admin';

  return (
    <div className="space-y-6">

      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="text-lg font-semibold">{user.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Login ID</p>
                <p className="text-lg font-semibold">{user.loginId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-lg font-semibold">{user.email}</p>
              </div>
              {user.employee && (
                <div>
                  <p className="text-sm text-muted-foreground">Employee Code</p>
                  <p className="text-lg font-semibold">{user.employee.code}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="private">Private Info</TabsTrigger>
          {showSalaryTab && <TabsTrigger value="salary">Salary Info</TabsTrigger>}
          {showCompanyTab && <TabsTrigger value="company">Company</TabsTrigger>}
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Resume Tab */}
        <TabsContent value="resume">
          <Card>
            <CardHeader>
              <CardTitle>Resume</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="about">About</Label>
                  <Edit2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <Textarea
                  id="about"
                  placeholder="Tell us about yourself..."
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="jobLove">What I love about my job</Label>
                  <Edit2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <Textarea
                  id="jobLove"
                  placeholder="What do you love about your job?"
                  value={jobLove}
                  onChange={(e) => setJobLove(e.target.value)}
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="hobbies">My interests and hobbies</Label>
                  <Edit2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <Textarea
                  id="hobbies"
                  placeholder="What are your interests and hobbies?"
                  value={hobbies}
                  onChange={(e) => setHobbies(e.target.value)}
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label>Skills</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="flex items-center gap-1">
                      {skill}
                      <button
                        onClick={() => handleRemoveSkill(skill)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add skill"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddSkill();
                      }
                    }}
                  />
                  <Button onClick={handleAddSkill} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Skill
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Certifications</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {certifications.map((cert) => (
                    <Badge key={cert} variant="secondary" className="flex items-center gap-1">
                      {cert}
                      <button
                        onClick={() => handleRemoveCertification(cert)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add certification"
                    value={newCertification}
                    onChange={(e) => setNewCertification(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddCertification();
                      }
                    }}
                  />
                  <Button onClick={handleAddCertification} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Certification
                  </Button>
                </div>
              </div>

              <Button
                onClick={handleSaveResume}
                disabled={updateProfileMutation.isPending}
                className="w-full"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Private Info Tab */}
        <TabsContent value="private">
          <Card>
            <CardHeader>
              <CardTitle>Private Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loginId">Login ID</Label>
                  <Input id="loginId" value={user.loginId || 'N/A'} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user.email} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter phone number"
                    aria-label="Phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={userCompany}
                    onChange={(e) => setUserCompany(e.target.value)}
                    placeholder="Enter company"
                    aria-label="Company"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Enter department"
                    aria-label="Department"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager">Manager</Label>
                  <Input
                    id="manager"
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    placeholder="Enter manager"
                    aria-label="Manager"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter location"
                    aria-label="Location"
                  />
                </div>
              </div>

              {/* Bank Details Card */}
              {user.employee && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Bank Details
                    </CardTitle>
                    <CardDescription>Bank account information for payroll</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bankName">Bank Name</Label>
                        <Input
                          id="bankName"
                          value={'Not provided'}
                          disabled
                          aria-label="Bank name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accountNumber">Account Number</Label>
                        <Input
                          id="accountNumber"
                          value={'Not provided'}
                          disabled
                          aria-label="Account number (masked)"
                        />
                        <p className="text-xs text-muted-foreground">
                          Only last 4 digits are shown for security
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ifsc">IFSC Code</Label>
                        <Input
                          id="ifsc"
                          value={'Not provided'}
                          disabled
                          aria-label="IFSC code"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="branch">Branch</Label>
                        <Input
                          id="branch"
                          value={'Not provided'}
                          disabled
                          aria-label="Branch"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Bank details can be updated by contacting HR or Admin
                    </p>
                  </CardContent>
                </Card>
              )}

              <FormFooter
                primaryAction={{
                  label: 'Save Changes',
                  onClick: handleSavePrivateInfo,
                  loading: updateProfileMutation.isPending,
                }}
                secondaryAction={{
                  label: 'Cancel',
                  onClick: () => {
                    // Reset form to original values
                    setPhone(user.phone || '');
                    setUserCompany(user.company || '');
                    setDepartment(user.department || '');
                    setManager(user.manager || '');
                    setLocation(user.location || '');
                  },
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary Info Tab */}
        {showSalaryTab && (
          <TabsContent value="salary">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Salary Info</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isAdminOrPayroll 
                        ? 'View and edit salary information for employees (Admin/Payroll Officer)'
                        : 'View your salary information (Read-only)'}
                    </p>
                  </div>
                  {canEditSalary && !editingSalary && salaryConfig && (
                    <div className="flex gap-2">
                      <Button onClick={() => setEditingSalary(true)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit Salary
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={() => setDeleteConfirmOpen(true)}
                        disabled={deleteSalaryMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  )}
                  {canEditSalary && editingSalary && (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleCancelEditSalary}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveSalary} disabled={updateSalaryMutation.isPending}>
                        {updateSalaryMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Employee Selector for Admin/Payroll - Always show if admin/payroll */}
                {isAdminOrPayroll && (
                  <div className="mb-6">
                    <Label htmlFor="employee-select">Select Employee</Label>
                    {isLoadingEmployees ? (
                      <div className="mt-1 p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground">Loading employees...</p>
                      </div>
                    ) : employees && employees.length > 0 ? (
                      <Select
                        value={selectedEmployeeId || employees[0]?.id || ''}
                        onValueChange={(value) => {
                          setSelectedEmployeeId(value);
                          setEditingSalary(false); // Reset edit mode when switching employees
                        }}
                      >
                        <SelectTrigger id="employee-select" className="mt-1">
                          <SelectValue placeholder="Select an employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.userName || 'Unknown'} ({emp.code}) - {emp.userEmail}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1 p-4 border rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">
                          No employees found. Please create employees first.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {!employeeIdForSalary && isAdminOrPayroll ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      {employees && employees.length > 0
                        ? 'Please select an employee to view their salary information.'
                        : 'No employees available. Please create employees first.'}
                    </p>
                  </div>
                ) : isLoadingSalaryConfig ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading salary information...</p>
                  </div>
                ) : !employeeIdForSalary ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No employee record found. Please contact admin.</p>
                  </div>
                ) : !salaryConfig ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      Salary configuration not available for this employee. Please configure salary first.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    
                    {/* General Salary Information - Top Section */}
                    <div className="grid grid-cols-2 gap-6">
                      {/* Left Column - Wage and Working Days */}
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium">Month Wage</Label>
                          <div className="mt-1 flex items-baseline gap-2">
                            <Input 
                              value={salaryConfig.monthlyWage.toLocaleString('en-IN', { minimumFractionDigits: 2 })} 
                              disabled 
                              className="text-lg font-semibold border-0 border-b-2 rounded-none px-0 bg-transparent"
                            />
                            <span className="text-muted-foreground">/ Month</span>
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Yearly wage</Label>
                          <div className="mt-1 flex items-baseline gap-2">
                            <Input 
                              value={salaryConfig.yearlyWage.toLocaleString('en-IN', { minimumFractionDigits: 2 })} 
                              disabled 
                              className="text-lg font-semibold border-0 border-b-2 rounded-none px-0 bg-transparent"
                            />
                            <span className="text-muted-foreground">/ Yearly</span>
                          </div>
                        </div>
                        <div className="border-t pt-4 space-y-4">
                          <div>
                            <Label className="text-sm font-medium">No of working days in a week:</Label>
                            <Input value="5" disabled className="mt-1 border-0 border-b-2 rounded-none px-0 bg-transparent" />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Break Time:</Label>
                            <div className="mt-1 flex items-center gap-2">
                              <Input value="1" disabled className="w-20 border-0 border-b-2 rounded-none px-0 bg-transparent" />
                              <span className="text-muted-foreground">/hrs</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column - Empty for layout balance */}
                      <div></div>
                    </div>

                    {/* Salary Components - Left Column */}
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold mb-4">Salary Components</h3>
                      <div className="space-y-4">
                        {/* Basic Salary */}
                        <div className="border-b pb-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <Label className="text-base font-medium">Basic Salary</Label>
                              <div className="mt-1 flex items-baseline gap-2">
                                {editingSalary && canEditSalary ? (
                                  <Input 
                                    type="number"
                                    value={editBasic}
                                    onChange={(e) => setEditBasic(parseFloat(e.target.value) || 0)}
                                    className="text-base font-semibold border-b-2 rounded-none px-0 bg-transparent w-32"
                                  />
                                ) : (
                                  <Input 
                                    value={salaryConfig.basic.toLocaleString('en-IN', { minimumFractionDigits: 2 })} 
                                    disabled 
                                    className="text-base font-semibold border-0 border-b-2 rounded-none px-0 bg-transparent w-32"
                                  />
                                )}
                                <span className="text-muted-foreground">₹ / month</span>
                                {!editingSalary && (
                                  <span className="text-muted-foreground ml-4">
                                    {((salaryConfig.basic / salaryConfig.monthlyWage) * 100).toFixed(2)} %
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Define Basic salary from company cost compute it based on monthly Wages
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* HRA */}
                        {(salaryConfig.allowances.hra || editingSalary) && (
                          <div className="border-b pb-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <Label className="text-base font-medium">House Rent Allowance</Label>
                                <div className="mt-1 flex items-baseline gap-2">
                                  {editingSalary && canEditSalary ? (
                                    <Input 
                                      type="number"
                                      value={editHRA}
                                      onChange={(e) => setEditHRA(parseFloat(e.target.value) || 0)}
                                      className="text-base font-semibold border-b-2 rounded-none px-0 bg-transparent w-32"
                                    />
                                  ) : (
                                    <Input 
                                      value={(salaryConfig.allowances.hra || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} 
                                      disabled 
                                      className="text-base font-semibold border-0 border-b-2 rounded-none px-0 bg-transparent w-32"
                                    />
                                  )}
                                  <span className="text-muted-foreground">₹ / month</span>
                                  {!editingSalary && salaryConfig.allowances.hra && (
                                    <span className="text-muted-foreground ml-4">
                                      {((salaryConfig.allowances.hra / salaryConfig.monthlyWage) * 100).toFixed(2)} %
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  HRA provided to employees 50% of the basic salary
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Standard Allowance */}
                        {(salaryConfig.allowances.standardAllowance || editingSalary) && (
                          <div className="border-b pb-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <Label className="text-base font-medium">Standard Allowance</Label>
                                <div className="mt-1 flex items-baseline gap-2">
                                  {editingSalary && canEditSalary ? (
                                    <Input 
                                      type="number"
                                      value={editStandardAllowance}
                                      onChange={(e) => setEditStandardAllowance(parseFloat(e.target.value) || 0)}
                                      className="text-base font-semibold border-b-2 rounded-none px-0 bg-transparent w-32"
                                    />
                                  ) : (
                                    <Input 
                                      value={(salaryConfig.allowances.standardAllowance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} 
                                      disabled 
                                      className="text-base font-semibold border-0 border-b-2 rounded-none px-0 bg-transparent w-32"
                                    />
                                  )}
                                  <span className="text-muted-foreground">₹ / month</span>
                                  {!editingSalary && salaryConfig.allowances.standardAllowance && (
                                    <span className="text-muted-foreground ml-4">
                                      {((salaryConfig.allowances.standardAllowance / salaryConfig.monthlyWage) * 100).toFixed(2)} %
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  A standard allowance is a predetermined, fixed amount provided to employee as part of their salary
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Performance Bonus */}
                        {(salaryConfig.allowances.performanceBonus || editingSalary) && (
                          <div className="border-b pb-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <Label className="text-base font-medium">Performance Bonus</Label>
                                <div className="mt-1 flex items-baseline gap-2">
                                  {editingSalary && canEditSalary ? (
                                    <Input 
                                      type="number"
                                      value={editPerformanceBonus}
                                      onChange={(e) => setEditPerformanceBonus(parseFloat(e.target.value) || 0)}
                                      className="text-base font-semibold border-b-2 rounded-none px-0 bg-transparent w-32"
                                    />
                                  ) : (
                                    <Input 
                                      value={(salaryConfig.allowances.performanceBonus || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} 
                                      disabled 
                                      className="text-base font-semibold border-0 border-b-2 rounded-none px-0 bg-transparent w-32"
                                    />
                                  )}
                                  <span className="text-muted-foreground">₹ / month</span>
                                  {!editingSalary && salaryConfig.allowances.performanceBonus && (
                                    <span className="text-muted-foreground ml-4">
                                      {((salaryConfig.allowances.performanceBonus / salaryConfig.monthlyWage) * 100).toFixed(2)} %
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Variable amount paid during payroll. The value defined by the company and calculated as a % of the basic salary
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* LTA */}
                        {(salaryConfig.allowances.lta || editingSalary) && (
                          <div className="border-b pb-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <Label className="text-base font-medium">Leave Travel Allowance</Label>
                                <div className="mt-1 flex items-baseline gap-2">
                                  {editingSalary && canEditSalary ? (
                                    <Input 
                                      type="number"
                                      value={editLTA}
                                      onChange={(e) => setEditLTA(parseFloat(e.target.value) || 0)}
                                      className="text-base font-semibold border-b-2 rounded-none px-0 bg-transparent w-32"
                                    />
                                  ) : (
                                    <Input 
                                      value={(salaryConfig.allowances.lta || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} 
                                      disabled 
                                      className="text-base font-semibold border-0 border-b-2 rounded-none px-0 bg-transparent w-32"
                                    />
                                  )}
                                  <span className="text-muted-foreground">₹ / month</span>
                                  {!editingSalary && salaryConfig.allowances.lta && (
                                    <span className="text-muted-foreground ml-4">
                                      {((salaryConfig.allowances.lta / salaryConfig.monthlyWage) * 100).toFixed(2)} %
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  LTA is paid by the company to employees to cover their travel expenses. and calculated as a % of the basic salary
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Fixed Allowance */}
                        {(salaryConfig.allowances.fixedAllowance || editingSalary) && (
                          <div className="border-b pb-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <Label className="text-base font-medium">Fixed Allowance</Label>
                                <div className="mt-1 flex items-baseline gap-2">
                                  {editingSalary && canEditSalary ? (
                                    <Input 
                                      type="number"
                                      value={editFixedAllowance}
                                      onChange={(e) => setEditFixedAllowance(parseFloat(e.target.value) || 0)}
                                      className="text-base font-semibold border-b-2 rounded-none px-0 bg-transparent w-32"
                                    />
                                  ) : (
                                    <Input 
                                      value={(salaryConfig.allowances.fixedAllowance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} 
                                      disabled 
                                      className="text-base font-semibold border-0 border-b-2 rounded-none px-0 bg-transparent w-32"
                                    />
                                  )}
                                  <span className="text-muted-foreground">₹ / month</span>
                                  {!editingSalary && salaryConfig.allowances.fixedAllowance && (
                                    <span className="text-muted-foreground ml-4">
                                      {((salaryConfig.allowances.fixedAllowance / salaryConfig.monthlyWage) * 100).toFixed(2)} %
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                  fixed allowance portion of wages is determined after calculating all salary components
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PF Contribution and Tax Deductions - Bottom Section */}
                    <div className="grid grid-cols-2 gap-6 border-t pt-6">
                      {/* Left Column - PF Contribution */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Provident Fund (PF) Contribution</h3>
                        
                        <div className="border-b pb-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <Label className="text-base font-medium">Employee</Label>
                              <div className="mt-1 flex items-baseline gap-2">
                                <Input 
                                  value={salaryConfig.pfEmployee.toLocaleString('en-IN', { minimumFractionDigits: 2 })} 
                                  disabled 
                                  className="text-base font-semibold border-0 border-b-2 rounded-none px-0 bg-transparent w-32"
                                />
                                <span className="text-muted-foreground">₹ / month</span>
                                <span className="text-muted-foreground ml-4">
                                  {salaryConfig.pfRate.toFixed(2)} %
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                PF is calculated based on the basic salary
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="border-b pb-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <Label className="text-base font-medium">Employer</Label>
                              <div className="mt-1 flex items-baseline gap-2">
                                <Input 
                                  value={salaryConfig.pfEmployer.toLocaleString('en-IN', { minimumFractionDigits: 2 })} 
                                  disabled 
                                  className="text-base font-semibold border-0 border-b-2 rounded-none px-0 bg-transparent w-32"
                                />
                                <span className="text-muted-foreground">₹ / month</span>
                                <span className="text-muted-foreground ml-4">
                                  {salaryConfig.pfRate.toFixed(2)} %
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                PF is calculated based on the basic salary
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column - Tax Deductions */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Tax Deductions</h3>
                        
                        <div className="border-b pb-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <Label className="text-base font-medium">Professional Tax</Label>
                              <div className="mt-1 flex items-baseline gap-2">
                                <Input 
                                  value={salaryConfig.professionalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })} 
                                  disabled 
                                  className="text-base font-semibold border-0 border-b-2 rounded-none px-0 bg-transparent w-32"
                                />
                                <span className="text-muted-foreground">₹ / month</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Professional Tax deducted from the Gross salary
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Company Tab */}
        {showCompanyTab && (
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {company ? (
                  <>
                    {editingCompany ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="companyName">Company Name</Label>
                          <Input
                            id="companyName"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Company Name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="companyLogoUrl">Logo URL</Label>
                          <Input
                            id="companyLogoUrl"
                            value={companyLogoUrl}
                            onChange={(e) => setCompanyLogoUrl(e.target.value)}
                            placeholder="https://example.com/logo.png"
                          />
                          <p className="text-sm text-muted-foreground">
                            Enter a direct URL to your company logo image
                          </p>
                        </div>
                        {companyLogoUrl && (
                          <div className="space-y-2">
                            <Label>Logo Preview</Label>
                            <div className="flex items-center gap-4">
                              <img
                                src={companyLogoUrl}
                                alt="Company logo"
                                className="h-16 w-16 rounded-lg object-cover border"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <p className="text-sm text-muted-foreground">
                                Logo preview (if URL is valid)
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            onClick={async () => {
                              try {
                                await companyApi.update({
                                  name: companyName,
                                  logoUrl: companyLogoUrl || null,
                                });
                                await refreshCompany();
                                setEditingCompany(false);
                                toast.success('Company information updated successfully');
                              } catch (error) {
                                toast.error(getErrorMessage(error));
                              }
                            }}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (company) {
                                setEditingCompany(false);
                                setCompanyName(company.name);
                                setCompanyLogoUrl(company.logoUrl || '');
                              }
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            {company.logoUrl && (
                              <img
                                src={company.logoUrl}
                                alt={company.name}
                                className="h-20 w-20 rounded-lg object-cover border"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <div>
                              <p className="text-sm text-muted-foreground">Company Name</p>
                              <p className="text-lg font-semibold">{company.name}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Company Code</p>
                            <p className="text-lg font-semibold">{company.code}</p>
                          </div>
                          {company.logoUrl && (
                            <div>
                              <p className="text-sm text-muted-foreground">Logo URL</p>
                              <p className="text-sm text-gray-600 break-all">{company.logoUrl}</p>
                            </div>
                          )}
                        </div>
                        <Button onClick={() => setEditingCompany(true)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit Company Information
                        </Button>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No company information available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="securityLoginId">Login ID</Label>
                <Input id="securityLoginId" value={user.loginId || 'N/A'} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Old Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                className="w-full"
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Changing...
                  </>
                ) : (
                  'Change Password'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Salary Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Salary Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the salary configuration for this employee? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleteSalaryMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (employeeIdForSalary) {
                  deleteSalaryMutation.mutate(employeeIdForSalary);
                  setDeleteConfirmOpen(false);
                }
              }}
              disabled={deleteSalaryMutation.isPending || !employeeIdForSalary}
            >
              {deleteSalaryMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

