/**
 * 本地存储管理
 * 使用 IndexedDB 存储账户信息和回执
 */

import { get, set, del, keys } from 'idb-keyval';

import type { StoredAccount, StoredReceipt } from '@askbox/shared-types';

const ACCOUNT_KEY = 'askbox_account';
const RECEIPTS_PREFIX = 'askbox_receipt_';

// ========================================
// 账户存储
// ========================================

/**
 * 保存账户到本地存储
 */
export async function saveAccount(account: StoredAccount): Promise<void> {
  await set(ACCOUNT_KEY, account);
}

/**
 * 获取存储的账户
 */
export async function getStoredAccount(): Promise<StoredAccount | null> {
  const account = await get<StoredAccount>(ACCOUNT_KEY);
  return account || null;
}

/**
 * 删除存储的账户
 */
export async function deleteAccount(): Promise<void> {
  await del(ACCOUNT_KEY);
}

/**
 * 检查是否有存储的账户
 */
export async function hasStoredAccount(): Promise<boolean> {
  const account = await getStoredAccount();
  return !!account;
}

// ========================================
// 回执存储
// ========================================

/**
 * 保存回执到本地存储
 */
export async function saveReceipt(receipt: StoredReceipt): Promise<void> {
  const key = `${RECEIPTS_PREFIX}${receipt.question_id}`;
  await set(key, receipt);
}

/**
 * 获取特定问题的回执
 */
export async function getReceipt(questionId: string): Promise<StoredReceipt | null> {
  const key = `${RECEIPTS_PREFIX}${questionId}`;
  const receipt = await get<StoredReceipt>(key);
  return receipt || null;
}

/**
 * 获取所有回执
 */
export async function getAllReceipts(): Promise<StoredReceipt[]> {
  const allKeys = await keys();
  const receiptKeys = allKeys.filter(k => 
    typeof k === 'string' && k.startsWith(RECEIPTS_PREFIX)
  );
  
  const receipts: StoredReceipt[] = [];
  for (const key of receiptKeys) {
    const receipt = await get<StoredReceipt>(key as string);
    if (receipt) {
      receipts.push(receipt);
    }
  }
  
  return receipts.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * 删除回执
 */
export async function deleteReceipt(questionId: string): Promise<void> {
  const key = `${RECEIPTS_PREFIX}${questionId}`;
  await del(key);
}

// ========================================
// 工具函数
// ========================================

/**
 * 清除所有本地数据
 */
export async function clearAllData(): Promise<void> {
  const allKeys = await keys();
  for (const key of allKeys) {
    if (typeof key === 'string' && 
        (key === ACCOUNT_KEY || key.startsWith(RECEIPTS_PREFIX))) {
      await del(key);
    }
  }
}
