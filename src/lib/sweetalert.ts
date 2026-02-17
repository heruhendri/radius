import Swal from 'sweetalert2';

// Cyberpunk theme configuration
const cyberpunkTheme = {
  background: 'linear-gradient(135deg, #0a0520 0%, #1a0a3a 100%)',
  borderColor: '#bc13fe',
  glowColor: 'rgba(188, 19, 254, 0.3)',
  textColor: '#e0d0ff',
  titleColor: '#ffffff',
};

// Success alert with cyberpunk theme
export const showSuccess = (message: string, title: string = 'Success!') => {
  return Swal.fire({
    icon: 'success',
    title,
    text: message,
    confirmButtonColor: '#00ff88',
    confirmButtonText: 'OK',
    background: cyberpunkTheme.background,
    color: cyberpunkTheme.textColor,
    customClass: {
      container: 'swal-cyberpunk',
      popup: 'swal-cyberpunk-popup',
      title: 'swal-cyberpunk-title',
      confirmButton: 'swal-cyberpunk-confirm'
    },
    didOpen: () => {
      const popup = Swal.getPopup();
      if (popup) {
        popup.style.border = `2px solid ${cyberpunkTheme.borderColor}`;
        popup.style.boxShadow = `0 0 30px ${cyberpunkTheme.glowColor}, inset 0 0 20px rgba(0, 247, 255, 0.1)`;
      }
    },
    heightAuto: false,
  });
};

// Error alert with cyberpunk theme
export const showError = (message: string, title: string = 'Error!') => {
  return Swal.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonColor: '#ff4466',
    confirmButtonText: 'OK',
    background: cyberpunkTheme.background,
    color: cyberpunkTheme.textColor,
    customClass: {
      container: 'swal-cyberpunk',
      popup: 'swal-cyberpunk-popup',
      title: 'swal-cyberpunk-title',
      confirmButton: 'swal-cyberpunk-error'
    },
    didOpen: () => {
      const popup = Swal.getPopup();
      if (popup) {
        popup.style.border = '2px solid #ff4466';
        popup.style.boxShadow = '0 0 30px rgba(255, 68, 102, 0.3), inset 0 0 20px rgba(255, 68, 102, 0.1)';
      }
    },
  });
};

// Warning alert with cyberpunk theme
export const showWarning = (message: string, title: string = 'Warning!') => {
  return Swal.fire({
    icon: 'warning',
    title,
    text: message,
    confirmButtonColor: '#fbbf24',
    confirmButtonText: 'OK',
    background: cyberpunkTheme.background,
    color: cyberpunkTheme.textColor,
    customClass: {
      container: 'swal-cyberpunk',
      popup: 'swal-cyberpunk-popup',
      title: 'swal-cyberpunk-title',
      confirmButton: 'swal-cyberpunk-warning'
    },
    didOpen: () => {
      const popup = Swal.getPopup();
      if (popup) {
        popup.style.border = '2px solid #fbbf24';
        popup.style.boxShadow = '0 0 30px rgba(251, 191, 36, 0.3), inset 0 0 20px rgba(251, 191, 36, 0.1)';
      }
    },
  });
};

// Info alert with cyberpunk theme
export const showInfo = (message: string, title: string = 'Info') => {
  return Swal.fire({
    icon: 'info',
    title,
    text: message,
    confirmButtonColor: '#00f7ff',
    confirmButtonText: 'OK',
    background: cyberpunkTheme.background,
    color: cyberpunkTheme.textColor,
    customClass: {
      container: 'swal-cyberpunk',
      popup: 'swal-cyberpunk-popup',
      title: 'swal-cyberpunk-title',
      confirmButton: 'swal-cyberpunk-info'
    },
    didOpen: () => {
      const popup = Swal.getPopup();
      if (popup) {
        popup.style.border = '2px solid #00f7ff';
        popup.style.boxShadow = '0 0 30px rgba(0, 247, 255, 0.3), inset 0 0 20px rgba(0, 247, 255, 0.1)';
      }
    },
  });
};

// Confirm dialog with cyberpunk theme
export const showConfirm = async (
  message: string,
  title: string = 'Are you sure?',
  confirmText: string = 'Yes',
  cancelText: string = 'Cancel'
) => {
  const result = await Swal.fire({
    icon: 'question',
    title,
    text: message,
    showCancelButton: true,
    confirmButtonColor: '#00f7ff',
    cancelButtonColor: '#6b7280',
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    background: cyberpunkTheme.background,
    color: cyberpunkTheme.textColor,
    customClass: {
      container: 'swal-cyberpunk',
      popup: 'swal-cyberpunk-popup',
      title: 'swal-cyberpunk-title',
      confirmButton: 'swal-cyberpunk-confirm',
      cancelButton: 'swal-cyberpunk-cancel'
    },
    didOpen: () => {
      const popup = Swal.getPopup();
      if (popup) {
        popup.style.border = `2px solid ${cyberpunkTheme.borderColor}`;
        popup.style.boxShadow = `0 0 30px ${cyberpunkTheme.glowColor}, inset 0 0 20px rgba(0, 247, 255, 0.1)`;
      }
    },
  });
  
  return result.isConfirmed;
};

// Loading alert with cyberpunk theme
export const showLoading = (message: string = 'Please wait...') => {
  return Swal.fire({
    title: message,
    allowOutsideClick: false,
    allowEscapeKey: false,
    background: cyberpunkTheme.background,
    color: cyberpunkTheme.textColor,
    customClass: {
      container: 'swal-cyberpunk',
      popup: 'swal-cyberpunk-popup',
      title: 'swal-cyberpunk-title'
    },
    didOpen: () => {
      Swal.showLoading();
      const popup = Swal.getPopup();
      if (popup) {
        popup.style.border = `2px solid ${cyberpunkTheme.borderColor}`;
        popup.style.boxShadow = `0 0 30px ${cyberpunkTheme.glowColor}, inset 0 0 20px rgba(0, 247, 255, 0.1)`;
      }
    },
  });
};

// Close loading
export const closeLoading = () => {
  Swal.close();
};

// Toast notification with cyberpunk theme
export const showToast = (
  message: string,
  icon: 'success' | 'error' | 'warning' | 'info' = 'success'
) => {
  const colors = {
    success: '#00ff88',
    error: '#ff4466',
    warning: '#fbbf24',
    info: '#00f7ff'
  };

  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: 'linear-gradient(135deg, rgba(10, 5, 32, 0.95) 0%, rgba(26, 10, 58, 0.95) 100%)',
    color: cyberpunkTheme.textColor,
    customClass: {
      container: 'swal-cyberpunk-toast',
      popup: 'swal-cyberpunk-toast-popup',
    },
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
      toast.style.border = `2px solid ${colors[icon]}`;
      toast.style.boxShadow = `0 0 20px ${colors[icon]}40, inset 0 0 15px ${colors[icon]}20`;
      toast.style.backdropFilter = 'blur(10px)';
    },
  });

  return Toast.fire({
    icon,
    title: message,
  });
};
