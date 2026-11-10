export const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com';
export const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/openai';
export const DEEPSEEK_MODELS = [
  { value: 'deepseek-flash', label: 'DeepSeek Flash' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek Pro' },
];
export const GEMINI_MODELS = [
  { value: 'gemini-3.8-flash', label: 'Gemini Flash' },
];
export function normalizeModel(c) {
  const provider = c.provider,
    model = String(c.model || '').trim(),
    key = String(c.key || '').trim();
  if (!['deepseek', 'gemini'].includes(provider))
    throw Error('请选择DeepSeek或Gemini模型名称');
  const models = provider === 'deepseek' ? DEEPSEEK_MODELS : GEMINI_MODELS;
  if (!models.some((m) => m.value === model)) throw Error('请选择有效模型版本');
  if (key.length > 512 || /\s/.test(key))
    throw Error('API Key格式不正确，请移除空格或换行');
  if (!key && !c.hasKey) throw Error('请先填写API Key');
  return {
    slot: 0,
    name: provider === 'deepseek' ? 'DeepSeek' : 'Gemini',
    provider,
    endpoint: provider === 'deepseek' ? DEEPSEEK_ENDPOINT : GEMINI_ENDPOINT,
    model,
    key,
  };
}
