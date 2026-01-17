import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qqxdfqerllirceqiwyex.supabase.co';
const supabaseKey = 'sb_publishable_MkJA39ZFUY8Wvu0DTwP9Yw_y_kfFiEm';

export const supabase = createClient(supabaseUrl, supabaseKey);