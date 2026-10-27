import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';

import { color, font, radius, space } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  hint?: string;
  maxLength?: number;
  showCount?: boolean;
  tall?: boolean;
};

export function TextField({ label, error, hint, showCount, tall, value, maxLength, ...input }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text variant="overline" color="textMuted">
          {label}
        </Text>
        {showCount && maxLength && (
          <Text variant="caption" color="textFaint">
            {(value ?? '').length.toLocaleString('en')}/{maxLength.toLocaleString('en')}
          </Text>
        )}
      </View>
      <TextInput
        {...input}
        value={value}
        maxLength={maxLength}
        accessibilityLabel={label}
        placeholderTextColor={color.textFaint}
        selectionColor={color.accent}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[
          styles.input,
          tall && styles.tall,
          focused && styles.focused,
          !!error && styles.invalid,
        ]}
        textAlignVertical={tall ? 'top' : 'center'}
      />
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : (
        hint && (
          <Text variant="caption" color="textFaint">
            {hint}
          </Text>
        )
      )}
    </View>
  );
}

type RowProps = {
  icon?: IconName;
  label: string;
  detail?: string;
  value?: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
};

export function ListRow({ icon, label, detail, value, onPress, disabled, tone = 'default' }: RowProps) {
  const content = (
    <>
      {icon && <Icon name={icon} size={18} tint={tone === 'danger' ? color.danger : color.textMuted} />}
      <View style={styles.rowText}>
        <Text variant="bodyStrong" color={tone === 'danger' ? 'danger' : 'text'}>
          {label}
        </Text>
        {detail && (
          <Text variant="caption" color="textFaint">
            {detail}
          </Text>
        )}
      </View>
      {value && (
        <Text variant="small" color="textMuted">
          {value}
        </Text>
      )}
      {onPress && !disabled && <Icon name="chevronRight" size={14} tint={color.textFaint} />}
    </>
  );
  if (!onPress) {
    return <View style={[styles.row, disabled && styles.disabled]}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}>
      {content}
    </Pressable>
  );
}

export function ToggleRow({
  icon,
  label,
  detail,
  value,
  onChange,
}: {
  icon?: IconName;
  label: string;
  detail?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      {icon && <Icon name={icon} size={18} tint={color.textMuted} />}
      <View style={styles.rowText}>
        <Text variant="bodyStrong">{label}</Text>
        {detail && (
          <Text variant="caption" color="textFaint">
            {detail}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: color.lineStrong, true: color.accent }}
        thumbColor={value ? color.onAccent : color.textMuted}
        ios_backgroundColor={color.lineStrong}
        // react-native-web ignores thumbColor for the "on" state and reads this instead.
        {...(Platform.OS === 'web' ? { activeThumbColor: color.onAccent } : null)}
      />
    </View>
  );
}

/** Groups rows into one card with hairline separators. */
export function RowGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    color: color.text,
    fontFamily: font.body,
    fontSize: 17,
  },
  tall: { minHeight: 200, fontFamily: font.serif, fontSize: 17, lineHeight: 26 },
  focused: { borderColor: color.accent },
  invalid: { borderColor: color.danger },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.sm },
  rowText: { flex: 1, gap: 2 },
  pressed: { backgroundColor: color.surfaceRaised },
  disabled: { opacity: 0.5 },
  group: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    overflow: 'hidden',
  },
});
