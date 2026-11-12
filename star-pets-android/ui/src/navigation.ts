export const TITLES: Record<string, string> = {
  home: '星星宠物',
  habits: '习惯培养',
  pets: '伙伴图鉴',
  records: '成长足迹',
  settings: '设置',
  detail: '伙伴档案',
  photo: '留下合影',
  photos: '回忆相册',
  memoryDetail: '回忆详情',
  habitComplete: '记录完成',
  habitEdit: '编辑习惯',
  children: '小朋友档案',
  childEdit: '编辑小朋友',
  goalLibrary: '习惯培养',
  voiceSettings: '设备语音',
  companionSettings: '伙伴与对话',
  goalDraft: '自定义习惯',
};

export const TOP_VIEWS = ['home', 'habits', 'photos', 'pets', 'settings'];

export const NAV_TABS = [
  ['habits', '习惯', 'habit'],
  ['photos', '回忆', 'camera'],
  ['home', '小窝', 'home'],
  ['pets', '伙伴', 'pet'],
  ['settings', '设置', 'settings'],
] as const;
