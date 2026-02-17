# Toast Notifications - Usage Examples

Complete examples of using Toast notifications in SALFANET RADIUS pages.

> **Note:** This is example/documentation code. Copy and adapt patterns to your actual components.

---

## Example: Adding Toast Notifications to User Management

**Reference:** `src/app/admin/pppoe-users/page.tsx` (example pattern)

```tsx
'use client';

import { useToast } from "@/components/ui/use-toast";
import { useState } from 'react';
import Swal from 'sweetalert2';

interface UserFormData {
  username: string;
  password: string;
  // ... other fields
}

interface User {
  id: string;
  username: string;
  // ... other fields
}

export default function PPPoEUsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    // Load users logic
  };

  // Example 1: User Creation
  const handleCreateUser = async (formData: UserFormData) => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/admin/pppoe-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // Success toast
        toast({
          title: "✅ User Created",
          description: `${formData.username} has been added successfully`,
        });

        // Refresh user list
        await loadUsers();
      } else {
        // Error toast
        toast({
          variant: "destructive",
          title: "❌ Failed to Create User",
          description: data.error || "Please try again",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "Network error. Please check your connection.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Example 2: User Deletion (with SweetAlert confirmation + Toast)
  const handleDeleteUser = async (userId: string, username: string) => {
    // Use SweetAlert for confirmation (critical action)
    const result = await Swal.fire({
      title: 'Delete User?',
      text: `Are you sure you want to delete ${username}? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) return;

    try {
      const response = await fetch(`/api/admin/pppoe-users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Success toast (quick feedback)
        toast({
          title: "🗑️ User Deleted",
          description: `${username} has been removed`,
        });

        await loadUsers();
      } else {
        const data = await response.json();
        toast({
          variant: "destructive",
          title: "❌ Failed to Delete",
          description: data.error || "Please try again",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "Failed to delete user",
      });
    }
  };

  // Example 3: User Update
  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      const response = await fetch(`/api/admin/pppoe-users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "✏️ User Updated",
          description: "Changes saved successfully",
        });

        await loadUsers();
      } else {
        toast({
          variant: "destructive",
          title: "❌ Update Failed",
          description: data.error,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "Failed to update user",
      });
    }
  };

  // Example 4: Bulk Operation (with progress)
  const handleBulkDelete = async (userIds: string[]) => {
    // Confirmation
    const result = await Swal.fire({
      title: 'Delete Multiple Users?',
      text: `Delete ${userIds.length} users? This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete all',
    });

    if (!result.isConfirmed) return;

    // Show processing toast
    toast({
      title: "⏳ Processing",
      description: `Deleting ${userIds.length} users...`,
      duration: 2000,
    });

    try {
      const response = await fetch('/api/admin/pppoe-users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      });

      const data = await response.json();

      if (response.ok) {
        // Success toast with count
        toast({
          title: "✅ Bulk Delete Complete",
          description: `${data.deletedCount} users removed successfully`,
        });

        await loadUsers();
      } else {
        toast({
          variant: "destructive",
          title: "❌ Bulk Delete Failed",
          description: data.error,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "Bulk delete failed",
      });
    }
  };

  // Example 5: CSV Export (with loading state)
  const handleExportCSV = async () => {
    toast({
      title: "📊 Exporting",
      description: "Generating CSV file...",
      duration: 2000,
    });

    try {
      const response = await fetch('/api/admin/pppoe-users/export');
      const blob = await response.blob();
      
      // Download file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pppoe-users-${Date.now()}.csv`;
      a.click();

      toast({
        title: "✅ Export Complete",
        description: "CSV file downloaded successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Export Failed",
        description: "Failed to generate CSV file",
      });
    }
  };

  // Example 6: Import CSV (with validation)
  const handleImportCSV = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    toast({
      title: "📥 Importing",
      description: "Processing CSV file...",
      duration: 3000,
    });

    try {
      const response = await fetch('/api/admin/pppoe-users/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "✅ Import Complete",
          description: `${data.imported} users imported, ${data.failed} failed`,
        });

        await loadUsers();
      } else {
        toast({
          variant: "destructive",
          title: "❌ Import Failed",
          description: data.error,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "Failed to import CSV",
      });
    }
  };

  // Example 7: Activate/Deactivate User
  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      const response = await fetch(`/api/admin/pppoe-users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const icon = newStatus === 'ACTIVE' ? '✅' : '⏸️';
        const action = newStatus === 'ACTIVE' ? 'activated' : 'deactivated';
        
        toast({
          title: `${icon} User ${action.charAt(0).toUpperCase() + action.slice(1)}`,
          description: `User status changed to ${newStatus.toLowerCase()}`,
        });

        await loadUsers();
      } else {
        toast({
          variant: "destructive",
          title: "❌ Failed",
          description: "Could not change user status",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "Status update failed",
      });
    }
  };

  // Example 8: Send COA (Change of Authorization)
  const handleSendCOA = async (userId: string, username: string) => {
    try {
      const response = await fetch(`/api/admin/radius/coa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "📡 COA Sent",
          description: `Disconnect packet sent to ${username}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "❌ COA Failed",
          description: data.error || "Failed to send disconnect",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "Failed to send COA",
      });
    }
  };

  // Example 9: Reset Password
  const handleResetPassword = async (userId: string, username: string) => {
    // Use SweetAlert for input
    const result = await Swal.fire({
      title: 'Reset Password',
      input: 'password',
      inputLabel: 'New Password',
      inputPlaceholder: 'Enter new password',
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) {
          return 'Please enter a password';
        }
        if (value.length < 6) {
          return 'Password must be at least 6 characters';
        }
      },
    });

    if (!result.isConfirmed) return;

    try {
      const response = await fetch(`/api/admin/pppoe-users/${userId}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: result.value }),
      });

      if (response.ok) {
        toast({
          title: "🔐 Password Reset",
          description: `Password for ${username} has been updated`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "❌ Failed",
          description: "Could not reset password",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Error",
        description: "Password reset failed",
      });
    }
  };

  // Example 10: Custom Duration Toast
  const handleLongRunningTask = async () => {
    // Show persistent toast for long task
    const toastId = toast({
      title: "⏳ Processing",
      description: "This may take several minutes...",
      duration: Infinity, // Won't auto-dismiss
    });

    try {
      const response = await fetch('/api/admin/long-task', {
        method: 'POST',
      });

      const data = await response.json();

      // Dismiss the loading toast
      // (Note: Current implementation doesn't return dismiss function,
      // but you can track and dismiss manually if needed)

      if (response.ok) {
        toast({
          title: "✅ Task Complete",
          description: data.message,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "❌ Task Failed",
        description: error.message,
      });
    }
  };

  return (
    <div>
      {/* UI components here */}
    </div>
  );
}

// ========================================
    }
  };

  return (
    <div>
      {/* UI components here */}
    </div>
  );
}
```

---

## 🎯 Key Patterns to Follow

### 1. **SweetAlert for Confirmations** (Critical Actions)
Use SweetAlert modals for:
- Delete operations
- Logout confirmations
- Critical data changes

### 2. **Toast for Feedback** (Non-blocking, Quick)
Use Toast notifications for:
- Success confirmations
- Error messages
- Status updates
- Processing states

### 3. **Always Handle Errors with Toast**
```tsx
try {
  await apiCall();
  toast({ title: "✅ Success" });
} catch (error) {
  toast({
    variant: "destructive",
    title: "❌ Error",
    description: "Operation failed",
  });
}
```

### 4. **Show Processing State for Long Operations**
```tsx
toast({ title: "⏳ Processing..." });
// ... operation
toast({ title: "✅ Complete" });
```

### 5. **Use Appropriate Icons**
- ✅ Success
- ❌ Error
- ⏳ Loading
- 🗑️ Delete
- 💰 Payment
- 📊 Export
- 📥 Import

### 6. **Keep Descriptions Short and Clear**
```tsx
// ✅ Good
toast({ description: "User created successfully" });

// ❌ Too long
toast({ description: "The user has been successfully created and added to the database with all the default settings applied..." });
```

### 7. **Refresh Data After Successful Operations**
```tsx
if (response.ok) {
  toast({ title: "✅ Success" });
  await loadUsers(); // Refresh
}
```

### 8. **Use try-catch for All API Calls**
Always wrap API calls in try-catch to handle errors gracefully.

---

## 📊 Comparison: Before vs After

### Before (SweetAlert Only)

```tsx
const handleDelete = async () => {
  const result = await Swal.fire({
    title: 'Delete?',
    showCancelButton: true,
  });
  
  if (result.isConfirmed) {
    await deleteUser();
    Swal.fire('Deleted!', 'User deleted', 'success');
  }
};
```

**Issues:**
- Blocking UI (modal covers screen)
- User must click OK to continue
- Slower interaction

### After (SweetAlert + Toast)

```tsx
const handleDelete = async () => {
  const result = await Swal.fire({
    title: 'Delete?',
    showCancelButton: true,
  });
  
  if (result.isConfirmed) {
    await deleteUser();
    toast({
      title: "✅ Deleted",
      description: "User removed successfully",
    });
  }
};
```

**Benefits:**
- ✅ Non-blocking (user can continue working)
- ✅ Faster (no need to click OK)
- ✅ Cleaner UI (small popup vs modal)
- ✅ Better UX for non-critical actions

---

## 🚀 Quick Reference

### Success Toast
```tsx
toast({
  title: "✅ Success",
  description: "Operation completed",
});
```

### Error Toast
```tsx
toast({
  variant: "destructive",
  title: "❌ Error",
  description: "Operation failed",
});
```

### Processing Toast
```tsx
toast({
  title: "⏳ Processing",
  description: "Please wait...",
  duration: 2000,
});
```

### Custom Duration
```tsx
toast({
  description: "5 second message",
  duration: 5000, // milliseconds
});
```

---

**Ready to use!** Copy these patterns to your actual components. 🎉
