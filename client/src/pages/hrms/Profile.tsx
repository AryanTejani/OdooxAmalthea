import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthContext';
import { useBrand } from '@/context/BrandContext';
import { authApi, hrmsApi, companyApi, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Edit2, X, Plus, Save, Building2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

  // Get salary configuration if admin/payroll and has employee
  const canViewSalary = user && (user.role === 'admin' || user.role === 'payroll') && user.employee;
  const canEditSalary = user && (user.role === 'admin' || user.role === 'payroll') && user.employee;
  const { data: salaryConfig, isLoading: isLoadingSalaryConfig } = useQuery({
    queryKey: ['employee', 'salary-config', user?.employee?.id],
    queryFn: () => hrmsApi.getSalaryConfiguration(user!.employee!.id),
    enabled: !!canViewSalary,
  });

  // Salary configuration state (for editing)
  const [editingSalaryConfig, setEditingSalaryConfig] = useState<{
    wage: number;
    componentConfig: Record<string, {
      type: 'PERCENTAGE_OF_WAGE' | 'PERCENTAGE_OF_BASIC' | 'FIXED_AMOUNT' | 'REMAINING_AMOUNT';
      value: number;
    }>;
    pfRate: number;
    professionalTax: number;
  } | null>(null);

  // Initialize editing state when config loads
  useEffect(() => {
    if (salaryConfig && canEditSalary) {
      setEditingSalaryConfig({
        wage: salaryConfig.wage,
        componentConfig: { ...salaryConfig.componentConfig },
        pfRate: salaryConfig.pfRate,
        professionalTax: salaryConfig.professionalTax,
      });
    }
  }, [salaryConfig, canEditSalary]);

  // Calculate salary components in real-time
  const calculatedSalary = useMemo(() => {
    if (!editingSalaryConfig) return null;

    const { wage, componentConfig, pfRate, professionalTax } = editingSalaryConfig;

    // Calculate Basic
    const basicConfig = componentConfig.basic || { type: 'PERCENTAGE_OF_WAGE', value: 50 };
    let basic = 0;
    if (basicConfig.type === 'PERCENTAGE_OF_WAGE') {
      basic = (wage * basicConfig.value) / 100;
    } else if (basicConfig.type === 'FIXED_AMOUNT') {
      basic = basicConfig.value;
    } else {
      basic = (wage * 50) / 100;
    }

    // Calculate other components
    const allowances: Record<string, number> = {};
    let calculatedTotal = basic;

    const componentOrder = ['hra', 'standardAllowance', 'performanceBonus', 'lta'];
    for (const componentName of componentOrder) {
      const config = componentConfig[componentName];
      if (!config) continue;

      let amount = 0;
      if (config.type === 'PERCENTAGE_OF_WAGE') {
        amount = (wage * config.value) / 100;
      } else if (config.type === 'PERCENTAGE_OF_BASIC') {
        amount = (basic * config.value) / 100;
      } else if (config.type === 'FIXED_AMOUNT') {
        amount = config.value;
      }

      allowances[componentName] = amount;
      calculatedTotal += amount;
    }

    // Calculate Fixed Allowance (remaining amount)
    const fixedAllowanceConfig = componentConfig.fixedAllowance;
    if (fixedAllowanceConfig && fixedAllowanceConfig.type === 'REMAINING_AMOUNT') {
      const fixedAllowance = wage - calculatedTotal;
      allowances.fixedAllowance = Math.max(0, fixedAllowance);
      calculatedTotal += allowances.fixedAllowance;
    } else if (fixedAllowanceConfig) {
      if (fixedAllowanceConfig.type === 'PERCENTAGE_OF_WAGE') {
        allowances.fixedAllowance = (wage * fixedAllowanceConfig.value) / 100;
      } else if (fixedAllowanceConfig.type === 'PERCENTAGE_OF_BASIC') {
        allowances.fixedAllowance = (basic * fixedAllowanceConfig.value) / 100;
      } else if (fixedAllowanceConfig.type === 'FIXED_AMOUNT') {
        allowances.fixedAllowance = fixedAllowanceConfig.value;
      }
      calculatedTotal += allowances.fixedAllowance || 0;
    }

    const monthlyWage = wage;
    const yearlyWage = monthlyWage * 12;
    const pfEmployee = (basic * pfRate) / 100;
    const pfEmployer = (basic * pfRate) / 100;
    const netSalary = monthlyWage - pfEmployee - professionalTax;

    return {
      basic,
      allowances,
      monthlyWage,
      yearlyWage,
      pfEmployee,
      pfEmployer,
      netSalary,
      totalComponents: calculatedTotal,
    };
  }, [editingSalaryConfig]);

  // Update salary configuration mutation
  const updateSalaryConfigMutation = useMutation({
    mutationFn: (data: {
      wage?: number;
      componentConfig?: Record<string, {
        type: 'PERCENTAGE_OF_WAGE' | 'PERCENTAGE_OF_BASIC' | 'FIXED_AMOUNT' | 'REMAINING_AMOUNT';
        value: number;
      }>;
      pfRate?: number;
      professionalTax?: number;
    }) => hrmsApi.updateSalaryConfiguration(user!.employee!.id, data),
    onSuccess: (updatedConfig) => {
      queryClient.setQueryData(['employee', 'salary-config', user?.employee?.id], updatedConfig);
      queryClient.invalidateQueries({ queryKey: ['employee', 'salary', user?.employee?.id] });
      setEditingSalaryConfig({
        wage: updatedConfig.wage,
        componentConfig: { ...updatedConfig.componentConfig },
        pfRate: updatedConfig.pfRate,
        professionalTax: updatedConfig.professionalTax,
      });
      toast.success('Salary configuration updated successfully');
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

  // After the check above, user is guaranteed to be defined
  const showSalaryTab = user.role === 'admin' || user.role === 'payroll';
  const showCompanyTab = user.role === 'admin';

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
      </div>

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
              <div className="grid grid-cols-2 gap-4">
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={userCompany}
                    onChange={(e) => setUserCompany(e.target.value)}
                    placeholder="Enter company"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Enter department"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager">Manager</Label>
                  <Input
                    id="manager"
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    placeholder="Enter manager"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter location"
                  />
                </div>
              </div>

              <Button
                onClick={handleSavePrivateInfo}
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

        {/* Salary Info Tab */}
        {showSalaryTab && (
          <TabsContent value="salary">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Salary Configuration</span>
                  {canEditSalary && editingSalaryConfig && (
                    <Button
                      onClick={() => {
                        if (!editingSalaryConfig) return;
                        updateSalaryConfigMutation.mutate({
                          wage: editingSalaryConfig.wage,
                          componentConfig: editingSalaryConfig.componentConfig,
                          pfRate: editingSalaryConfig.pfRate,
                          professionalTax: editingSalaryConfig.professionalTax,
                        });
                      }}
                      disabled={updateSalaryConfigMutation.isPending}
                    >
                      {updateSalaryConfigMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Configuration
                        </>
                      )}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingSalaryConfig ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading salary configuration...</p>
                  </div>
                ) : editingSalaryConfig && calculatedSalary ? (
                  <div className="space-y-6">
                    {/* Wage Configuration */}
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="wage">Monthly Wage (₹)</Label>
                        <Input
                          id="wage"
                          type="number"
                          value={editingSalaryConfig.wage}
                          onChange={(e) => {
                            const newWage = parseFloat(e.target.value) || 0;
                            setEditingSalaryConfig({
                              ...editingSalaryConfig,
                              wage: newWage,
                            });
                          }}
                          disabled={!canEditSalary}
                          className="text-lg"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Monthly Wage</p>
                          <p className="text-2xl font-bold">₹{calculatedSalary.monthlyWage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Yearly Wage</p>
                          <p className="text-2xl font-bold">₹{calculatedSalary.yearlyWage.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>
                    </div>

                    {/* Component Configuration */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Salary Components</h3>
                      
                      {/* Basic Salary */}
                      <div className="grid grid-cols-3 gap-4 items-end">
                        <div>
                          <Label>Basic Salary</Label>
                          <Select
                            value={editingSalaryConfig.componentConfig.basic?.type || 'PERCENTAGE_OF_WAGE'}
                            onValueChange={(value: any) => {
                              setEditingSalaryConfig({
                                ...editingSalaryConfig,
                                componentConfig: {
                                  ...editingSalaryConfig.componentConfig,
                                  basic: {
                                    type: value,
                                    value: editingSalaryConfig.componentConfig.basic?.value || 50,
                                  },
                                },
                              });
                            }}
                            disabled={!canEditSalary}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PERCENTAGE_OF_WAGE">% of Wage</SelectItem>
                              <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>
                            {editingSalaryConfig.componentConfig.basic?.type === 'FIXED_AMOUNT' ? 'Amount (₹)' : 'Percentage (%)'}
                          </Label>
                          <Input
                            type="number"
                            value={editingSalaryConfig.componentConfig.basic?.value || 50}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              setEditingSalaryConfig({
                                ...editingSalaryConfig,
                                componentConfig: {
                                  ...editingSalaryConfig.componentConfig,
                                  basic: {
                                    type: editingSalaryConfig.componentConfig.basic?.type || 'PERCENTAGE_OF_WAGE',
                                    value: newValue,
                                  },
                                },
                              });
                            }}
                            disabled={!canEditSalary}
                          />
                        </div>
                        <div>
                          <Label>Calculated Amount</Label>
                          <p className="text-lg font-semibold">₹{calculatedSalary.basic.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>

                      {/* HRA */}
                      <div className="grid grid-cols-3 gap-4 items-end">
                        <div>
                          <Label>House Rent Allowance (HRA)</Label>
                          <Select
                            value={editingSalaryConfig.componentConfig.hra?.type || 'PERCENTAGE_OF_BASIC'}
                            onValueChange={(value: any) => {
                              setEditingSalaryConfig({
                                ...editingSalaryConfig,
                                componentConfig: {
                                  ...editingSalaryConfig.componentConfig,
                                  hra: {
                                    type: value,
                                    value: editingSalaryConfig.componentConfig.hra?.value || 50,
                                  },
                                },
                              });
                            }}
                            disabled={!canEditSalary}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PERCENTAGE_OF_WAGE">% of Wage</SelectItem>
                              <SelectItem value="PERCENTAGE_OF_BASIC">% of Basic</SelectItem>
                              <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>
                            {editingSalaryConfig.componentConfig.hra?.type === 'FIXED_AMOUNT' ? 'Amount (₹)' : 'Percentage (%)'}
                          </Label>
                          <Input
                            type="number"
                            value={editingSalaryConfig.componentConfig.hra?.value || 50}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              setEditingSalaryConfig({
                                ...editingSalaryConfig,
                                componentConfig: {
                                  ...editingSalaryConfig.componentConfig,
                                  hra: {
                                    type: editingSalaryConfig.componentConfig.hra?.type || 'PERCENTAGE_OF_BASIC',
                                    value: newValue,
                                  },
                                },
                              });
                            }}
                            disabled={!canEditSalary}
                          />
                        </div>
                        <div>
                          <Label>Calculated Amount</Label>
                          <p className="text-lg font-semibold">₹{calculatedSalary.allowances.hra?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</p>
                        </div>
                      </div>

                      {/* Standard Allowance */}
                      <div className="grid grid-cols-3 gap-4 items-end">
                        <div>
                          <Label>Standard Allowance</Label>
                          <Select
                            value={editingSalaryConfig.componentConfig.standardAllowance?.type || 'FIXED_AMOUNT'}
                            onValueChange={(value: any) => {
                              setEditingSalaryConfig({
                                ...editingSalaryConfig,
                                componentConfig: {
                                  ...editingSalaryConfig.componentConfig,
                                  standardAllowance: {
                                    type: value,
                                    value: editingSalaryConfig.componentConfig.standardAllowance?.value || 4167,
                                  },
                                },
                              });
                            }}
                            disabled={!canEditSalary}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PERCENTAGE_OF_WAGE">% of Wage</SelectItem>
                              <SelectItem value="PERCENTAGE_OF_BASIC">% of Basic</SelectItem>
                              <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>
                            {editingSalaryConfig.componentConfig.standardAllowance?.type === 'FIXED_AMOUNT' ? 'Amount (₹)' : 'Percentage (%)'}
                          </Label>
                          <Input
                            type="number"
                            value={editingSalaryConfig.componentConfig.standardAllowance?.value || 4167}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              setEditingSalaryConfig({
                                ...editingSalaryConfig,
                                componentConfig: {
                                  ...editingSalaryConfig.componentConfig,
                                  standardAllowance: {
                                    type: editingSalaryConfig.componentConfig.standardAllowance?.type || 'FIXED_AMOUNT',
                                    value: newValue,
                                  },
                                },
                              });
                            }}
                            disabled={!canEditSalary}
                          />
                        </div>
                        <div>
                          <Label>Calculated Amount</Label>
                          <p className="text-lg font-semibold">₹{calculatedSalary.allowances.standardAllowance?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</p>
                        </div>
                      </div>

                      {/* Performance Bonus */}
                      <div className="grid grid-cols-3 gap-4 items-end">
                        <div>
                          <Label>Performance Bonus</Label>
                          <Select
                            value={editingSalaryConfig.componentConfig.performanceBonus?.type || 'PERCENTAGE_OF_BASIC'}
                            onValueChange={(value: any) => {
                              setEditingSalaryConfig({
                                ...editingSalaryConfig,
                                componentConfig: {
                                  ...editingSalaryConfig.componentConfig,
                                  performanceBonus: {
                                    type: value,
                                    value: editingSalaryConfig.componentConfig.performanceBonus?.value || 8.33,
                                  },
                                },
                              });
                            }}
                            disabled={!canEditSalary}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PERCENTAGE_OF_WAGE">% of Wage</SelectItem>
                              <SelectItem value="PERCENTAGE_OF_BASIC">% of Basic</SelectItem>
                              <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>
                            {editingSalaryConfig.componentConfig.performanceBonus?.type === 'FIXED_AMOUNT' ? 'Amount (₹)' : 'Percentage (%)'}
                          </Label>
                          <Input
                            type="number"
                            value={editingSalaryConfig.componentConfig.performanceBonus?.value || 8.33}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              setEditingSalaryConfig({
                                ...editingSalaryConfig,
                                componentConfig: {
                                  ...editingSalaryConfig.componentConfig,
                                  performanceBonus: {
                                    type: editingSalaryConfig.componentConfig.performanceBonus?.type || 'PERCENTAGE_OF_BASIC',
                                    value: newValue,
                                  },
                                },
                              });
                            }}
                            disabled={!canEditSalary}
                          />
                        </div>
                        <div>
                          <Label>Calculated Amount</Label>
                          <p className="text-lg font-semibold">₹{calculatedSalary.allowances.performanceBonus?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</p>
                        </div>
                      </div>

                      {/* Leave Travel Allowance (LTA) */}
                      <div className="grid grid-cols-3 gap-4 items-end">
                        <div>
                          <Label>Leave Travel Allowance (LTA)</Label>
                          <Select
                            value={editingSalaryConfig.componentConfig.lta?.type || 'PERCENTAGE_OF_BASIC'}
                            onValueChange={(value: any) => {
                              setEditingSalaryConfig({
                                ...editingSalaryConfig,
                                componentConfig: {
                                  ...editingSalaryConfig.componentConfig,
                                  lta: {
                                    type: value,
                                    value: editingSalaryConfig.componentConfig.lta?.value || 8.333,
                                  },
                                },
                              });
                            }}
                            disabled={!canEditSalary}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PERCENTAGE_OF_WAGE">% of Wage</SelectItem>
                              <SelectItem value="PERCENTAGE_OF_BASIC">% of Basic</SelectItem>
                              <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>
                            {editingSalaryConfig.componentConfig.lta?.type === 'FIXED_AMOUNT' ? 'Amount (₹)' : 'Percentage (%)'}
                          </Label>
                          <Input
                            type="number"
                            value={editingSalaryConfig.componentConfig.lta?.value || 8.333}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              setEditingSalaryConfig({
                                ...editingSalaryConfig,
                                componentConfig: {
                                  ...editingSalaryConfig.componentConfig,
                                  lta: {
                                    type: editingSalaryConfig.componentConfig.lta?.type || 'PERCENTAGE_OF_BASIC',
                                    value: newValue,
                                  },
                                },
                              });
                            }}
                            disabled={!canEditSalary}
                          />
                        </div>
                        <div>
                          <Label>Calculated Amount</Label>
                          <p className="text-lg font-semibold">₹{calculatedSalary.allowances.lta?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</p>
                        </div>
                      </div>

                      {/* Fixed Allowance (Remaining Amount) */}
                      <div className="grid grid-cols-3 gap-4 items-end">
                        <div>
                          <Label>Fixed Allowance</Label>
                          <Select
                            value={editingSalaryConfig.componentConfig.fixedAllowance?.type || 'REMAINING_AMOUNT'}
                            onValueChange={(value: any) => {
                              setEditingSalaryConfig({
                                ...editingSalaryConfig,
                                componentConfig: {
                                  ...editingSalaryConfig.componentConfig,
                                  fixedAllowance: {
                                    type: value,
                                    value: editingSalaryConfig.componentConfig.fixedAllowance?.value || 0,
                                  },
                                },
                              });
                            }}
                            disabled={!canEditSalary}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="REMAINING_AMOUNT">Remaining Amount</SelectItem>
                              <SelectItem value="PERCENTAGE_OF_WAGE">% of Wage</SelectItem>
                              <SelectItem value="PERCENTAGE_OF_BASIC">% of Basic</SelectItem>
                              <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>
                            {editingSalaryConfig.componentConfig.fixedAllowance?.type === 'REMAINING_AMOUNT' 
                              ? 'Auto-calculated' 
                              : editingSalaryConfig.componentConfig.fixedAllowance?.type === 'FIXED_AMOUNT' 
                                ? 'Amount (₹)' 
                                : 'Percentage (%)'}
                          </Label>
                          <Input
                            type="number"
                            value={editingSalaryConfig.componentConfig.fixedAllowance?.value || 0}
                            onChange={(e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              setEditingSalaryConfig({
                                ...editingSalaryConfig,
                                componentConfig: {
                                  ...editingSalaryConfig.componentConfig,
                                  fixedAllowance: {
                                    type: editingSalaryConfig.componentConfig.fixedAllowance?.type || 'REMAINING_AMOUNT',
                                    value: newValue,
                                  },
                                },
                              });
                            }}
                            disabled={!canEditSalary || editingSalaryConfig.componentConfig.fixedAllowance?.type === 'REMAINING_AMOUNT'}
                          />
                        </div>
                        <div>
                          <Label>Calculated Amount</Label>
                          <p className="text-lg font-semibold">₹{calculatedSalary.allowances.fixedAllowance?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</p>
                        </div>
                      </div>

                      {/* Summary Table */}
                      <div className="mt-6">
                        <h4 className="text-md font-semibold mb-2">Component Summary</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Component</TableHead>
                              <TableHead className="text-right">Amount (₹)</TableHead>
                              <TableHead className="text-right">% of Wage</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>Basic Salary</TableCell>
                              <TableCell className="text-right">₹{calculatedSalary.basic.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right">
                                {((calculatedSalary.basic / calculatedSalary.monthlyWage) * 100).toFixed(2)}%
                              </TableCell>
                            </TableRow>
                            {Object.entries(calculatedSalary.allowances).map(([key, value]) => (
                              <TableRow key={key}>
                                <TableCell>{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}</TableCell>
                                <TableCell className="text-right">₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right">
                                  {((value / calculatedSalary.monthlyWage) * 100).toFixed(2)}%
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-semibold">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right">₹{calculatedSalary.totalComponents.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right">
                                {((calculatedSalary.totalComponents / calculatedSalary.monthlyWage) * 100).toFixed(2)}%
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                        {calculatedSalary.totalComponents > calculatedSalary.monthlyWage + 1 && (
                          <p className="text-sm text-red-600 mt-2">
                            Warning: Total components exceed wage by ₹{(calculatedSalary.totalComponents - calculatedSalary.monthlyWage).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* PF Configuration */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Provident Fund (PF) Configuration</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="pfRate">PF Rate (%)</Label>
                          <Input
                            id="pfRate"
                            type="number"
                            step="0.01"
                            value={editingSalaryConfig.pfRate}
                            onChange={(e) => {
                              const newRate = parseFloat(e.target.value) || 0;
                              setEditingSalaryConfig({
                                ...editingSalaryConfig,
                                pfRate: newRate,
                              });
                            }}
                            disabled={!canEditSalary}
                          />
                        </div>
                        <div>
                          <Label>PF Employee Contribution</Label>
                          <p className="text-lg font-semibold">₹{calculatedSalary.pfEmployee.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / month</p>
                        </div>
                        <div>
                          <Label>PF Employer Contribution</Label>
                          <p className="text-lg font-semibold">₹{calculatedSalary.pfEmployer.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / month</p>
                        </div>
                      </div>
                    </div>

                    {/* Professional Tax Configuration */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Tax Deductions</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="professionalTax">Professional Tax (₹)</Label>
                          <Input
                            id="professionalTax"
                            type="number"
                            step="0.01"
                            value={editingSalaryConfig.professionalTax}
                            onChange={(e) => {
                              const newTax = parseFloat(e.target.value) || 0;
                              setEditingSalaryConfig({
                                ...editingSalaryConfig,
                                professionalTax: newTax,
                              });
                            }}
                            disabled={!canEditSalary}
                          />
                        </div>
                        <div>
                          <Label>Professional Tax</Label>
                          <p className="text-lg font-semibold">₹{editingSalaryConfig.professionalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / month</p>
                        </div>
                      </div>
                    </div>

                    {/* Net Salary Summary */}
                    <div className="pt-4 border-t">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Net Salary</p>
                          <p className="text-3xl font-bold text-green-600">₹{calculatedSalary.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                        {canEditSalary && (
                          <Button
                            onClick={() => {
                              if (!editingSalaryConfig) return;
                              updateSalaryConfigMutation.mutate({
                                wage: editingSalaryConfig.wage,
                                componentConfig: editingSalaryConfig.componentConfig,
                                pfRate: editingSalaryConfig.pfRate,
                                professionalTax: editingSalaryConfig.professionalTax,
                              });
                            }}
                            disabled={updateSalaryConfigMutation.isPending}
                            size="lg"
                          >
                            {updateSalaryConfigMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Configuration
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Salary configuration not available</p>
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
    </div>
  );
}

