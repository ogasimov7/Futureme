import * as Sharing from 'expo-sharing';
import type { ComponentRef, RefObject } from 'react';
import { Platform, Share, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Shares a rendered view as a PNG (for Instagram/TikTok stories). Falls back to sharing
 * plain text where image capture or the native share sheet isn't available (web).
 * Returns false only if both paths fail.
 */
export async function shareViewAsImage(ref: RefObject<ComponentRef<typeof View> | null>, fallbackText: string): Promise<boolean> {
  if (Platform.OS !== 'web' && ref.current) {
    try {
      if (await Sharing.isAvailableAsync()) {
        const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Future Roast' });
        return true;
      }
    } catch {
      // Fall through to text sharing.
    }
  }
  try {
    await Share.share({ message: fallbackText });
    return true;
  } catch {
    return false;
  }
}
