(() => {
  'use strict';

  const MAX_FILE_BYTES = 8 * 1024 * 1024; // matches the server's multer limit

  const states = {
    invalid: document.getElementById('stateInvalid'),
    ready: document.getElementById('stateReady'),
    uploading: document.getElementById('stateUploading'),
    success: document.getElementById('stateSuccess'),
    error: document.getElementById('stateError'),
  };

  function showState(name) {
    for (const key in states) {
      states[key].hidden = key !== name;
    }
  }

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    showState('invalid');
    return;
  }

  const fileInput = document.getElementById('fileInput');
  const preview = document.getElementById('preview');
  const uploadButton = document.getElementById('uploadButton');
  const fileError = document.getElementById('fileError');
  const uploadErrorText = document.getElementById('uploadErrorText');
  const retryButton = document.getElementById('retryButton');
  const retakeButton = document.getElementById('retakeButton');

  let selectedFile = null;
  let previewUrl = null;

  function resetPicker() {
    selectedFile = null;
    uploadButton.disabled = true;
    fileError.hidden = true;
    preview.hidden = true;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    fileInput.value = '';
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    fileError.hidden = true;

    if (!file) {
      resetPicker();
      return;
    }
    if (!file.type.startsWith('image/')) {
      fileError.textContent = 'الملف المختار ليس صورة';
      fileError.hidden = false;
      resetPicker();
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      fileError.textContent = 'حجم الصورة أكبر من الحد المسموح (8 ميغابايت)';
      fileError.hidden = false;
      resetPicker();
      return;
    }

    selectedFile = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    preview.hidden = false;
    uploadButton.disabled = false;
  });

  async function upload() {
    if (!selectedFile) return;
    showState('uploading');

    const form = new FormData();
    form.append('image', selectedFile);

    try {
      const res = await fetch('/api/capture/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        let message = 'تعذّر رفع الصورة';
        try {
          const body = await res.json();
          if (body && body.error) message = body.error;
        } catch {
          // response wasn't JSON — keep the default message
        }
        uploadErrorText.textContent = message;
        showState('error');
        return;
      }

      showState('success');
    } catch {
      uploadErrorText.textContent = 'تعذّر الاتصال بالخادم، تحقّق من اتصال الشبكة وحاول من جديد';
      showState('error');
    }
  }

  uploadButton.addEventListener('click', upload);
  retryButton.addEventListener('click', () => {
    if (selectedFile) {
      upload();
    } else {
      showState('ready');
    }
  });
  retakeButton.addEventListener('click', () => {
    resetPicker();
    showState('ready');
  });

  showState('ready');
})();
