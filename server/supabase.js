/**
 * Supabase Client & Storage Module
 * Hỗ trợ kết nối Cloud Database và Cloud Storage của Supabase
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
  console.log('⚡ Đã kết nối Supabase Cloud Client:', SUPABASE_URL);
} else {
  console.log('ℹ️ Chưa cấu hình SUPABASE_URL / SUPABASE_KEY trong .env (đang dùng chế độ SQLite mặc định).');
}

/**
 * Upload file CSV hoặc tài liệu lên Supabase Cloud Storage bucket
 * @param {string} bucketName - Tên bucket (mặc định 'spendwise-storage')
 * @param {string} filePath - Đường dẫn lưu trữ trên cloud (ví dụ: 'exports/transactions_2026.csv')
 * @param {Buffer|string} fileContent - Nội dung tệp
 * @param {string} contentType - MIME type (ví dụ: 'text/csv')
 */
async function uploadToSupabaseStorage(bucketName = 'spendwise-storage', filePath, fileContent, contentType = 'text/csv') {
  if (!supabase) {
    throw new Error('Supabase client chưa được cấu hình. Vui lòng kiểm tra SUPABASE_URL và SUPABASE_KEY.');
  }

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, fileContent, {
      contentType,
      upsert: true
    });

  if (error) {
    console.error('❌ Lỗi upload lên Supabase Storage:', error);
    throw error;
  }

  // Lấy Public URL của tệp
  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  return {
    path: data.path,
    publicUrl: publicUrlData.publicUrl
  };
}

module.exports = {
  supabase,
  uploadToSupabaseStorage
};
