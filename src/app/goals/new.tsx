import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/Feedback';
import { TextField } from '@/components/ui/Form';
import { Screen } from '@/components/ui/Screen';
import { useData } from '@/data/store';

export default function NewGoalScreen() {
  const { createGoal } = useData();
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (title.trim().length < 2) {
      setError('Hədəfə ad ver, lap gülməli olsa belə.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const goal = await createGoal({ title: title.trim(), why: why.trim() || null });
      router.replace({ pathname: '/missions/new', params: { goalId: goal.id } });
    } catch {
      setError('Hədəf yadda saxlanmadı. Yenidən cəhd et.');
      setSaving(false);
    }
  };

  return (
    <Screen insetTop={false}>
      <TextField label="Hədəf" value={title} onChangeText={setTitle} placeholder="Bu il 12 kitab oxu" maxLength={80} autoFocus />
      <TextField
        label="Niyə vacibdir? (istəyə bağlı)"
        value={why}
        onChangeText={setWhy}
        placeholder="Çünki beynim sonsuz skroldan yaxşısına layiqdir"
        maxLength={200}
        hint="Gələcəkdəki sən bunu sənə xatırladacaq. Sevgi ilə."
      />
      {error && <InlineNotice tone="error" message={error} />}
      <Button label="Saxla və missiya əlavə et" onPress={save} loading={saving} />
    </Screen>
  );
}
