/** Shared UI depends only on this interface. Android Java and a future iOS Swift bridge implement it. */
export interface PlatformStatus {
  authenticated: boolean;
  biometric: boolean;
  bioAvailable: boolean;
  remembered?: boolean;
  version: string;
  notifications: boolean;
}
declare global {
  interface Window {
    StarNative?: {
      platform?: string;
      request(id: string, action: string, args: string): void;
    };
    nativeReply: (id: string, error: string | null, data: unknown) => void;
    recordFinished?: (data: { file: string }) => void;
    lockApp?: () => void;
    appBack?: () => void;
  }
}
const pending = new Map<
  string,
  {
    resolve: (v: any) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
window.nativeReply = (id, error, data) => {
  const p = pending.get(id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(id);
  error ? p.reject(new Error(error)) : p.resolve(data);
};
export const isNative = !!window.StarNative;
export async function native<T = any>(
  action: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!window.StarNative) {
    if (action === 'pickPhoto' || action === 'camera')
      return browserPhoto(action === 'camera') as Promise<T>;
    if (action === 'bio') await browserBiometric();
    const r = await fetch('/__preview/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || '预览服务错误');
    return d;
  }
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(
      () => {
        pending.delete(id);
        reject(Error('操作等待超时，请重新打开核对结果'));
      },
      [
        'pickPhoto',
        'camera',
        'exportBackup',
        'importBackup',
        'importPet',
        'exportPhoto',
        'exportAudio',
      ].includes(action)
        ? 600000
        : 120000,
    );
    pending.set(id, { resolve, reject, timer });
    window.StarNative!.request(id, action, JSON.stringify(args));
  });
}

async function browserBiometric() {
  const cred = window.PublicKeyCredential;
  if (!cred || !(await cred.isUserVerifyingPlatformAuthenticatorAvailable()))
    throw Error('设备未配置可用的生物识别，请使用密码');
  const challenge = crypto.getRandomValues(new Uint8Array(32)),
    userId = crypto.getRandomValues(new Uint8Array(16));
  try {
    await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: '星星宠物', id: location.hostname },
        user: { id: userId, name: 'star-pets', displayName: '星星宠物' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
        },
        timeout: 60000,
        attestation: 'none',
      },
    });
  } catch (e: any) {
    if (e?.name === 'NotAllowedError' || e?.name === 'AbortError')
      throw Error('已取消，可使用密码登录');
    throw Error('设备未配置可用的生物识别，请使用密码');
  }
}
async function browserPhoto(camera: boolean) {
  const data = await new Promise<string>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.setAttribute('capture', 'environment');
    input.oncancel = () => reject(Error('已取消'));
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(Error('已取消'));
        return;
      }
      try {
        const bitmap = await createImageBitmap(file);
        const ratio = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height)),
          c = document.createElement('canvas');
        c.width = bitmap.width * ratio;
        c.height = bitmap.height * ratio;
        c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height);
        bitmap.close();
        resolve(c.toDataURL('image/jpeg', 0.9).split(',')[1]);
      } catch {
        reject(Error('无法读取照片'));
      }
    };
    input.click();
  });
  return native('photoUpload', { data });
}
