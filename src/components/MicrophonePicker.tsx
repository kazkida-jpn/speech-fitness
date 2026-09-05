import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/palette';
import type { MicrophoneSelection } from '@/hooks/use-microphone-selection';

type Props = {
  selection: MicrophoneSelection;
  /** Whether the user may change the microphone right now (false while recording). */
  enabled: boolean;
};

export function MicrophonePicker({ selection, enabled }: Props) {
  const {
    currentInputName,
    availableInputs,
    hasProbedInputs,
    selectedInputUid,
    isLoadingInputs,
    isListOpen,
    error,
  } = selection;
  const hasInputs = availableInputs.length > 0;

  return (
    <>
      <View style={styles.inputCard}>
        <View style={styles.inputIndicator} />
        <View style={styles.inputTextWrap}>
          <Text style={styles.inputLabel}>
            {hasProbedInputs ? '使用中のマイク' : '使用予定のマイク'}
          </Text>
          <Text style={styles.inputName}>{currentInputName}</Text>
          <Text style={styles.inputMeta}>
            {hasProbedInputs
              ? `${availableInputs.length}台の入力デバイスを認識`
              : '録音準備が整うと実際のマイク名を表示します'}
          </Text>
        </View>
        {enabled && (
          <Pressable
            style={[styles.inputAction, isLoadingInputs && styles.inputActionDisabled]}
            onPress={hasInputs ? selection.openList : selection.loadInputs}
            disabled={isLoadingInputs}>
            <Text style={styles.inputActionText}>
              {isLoadingInputs ? '確認中…' : hasInputs ? '変更' : '選ぶ'}
            </Text>
          </Pressable>
        )}
      </View>

      {enabled && isListOpen && hasInputs && (
        <View style={styles.inputList}>
          <Text style={styles.inputListTitle}>使用するマイクを選択</Text>
          {availableInputs.map((input) => {
            const selected = selectedInputUid === input.uid;
            return (
              <Pressable
                key={input.uid}
                style={[styles.inputOption, selected && styles.inputOptionSelected]}
                onPress={() => selection.selectInput(input)}>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected && <View style={styles.radioDot} />}
                </View>
                <View style={styles.inputOptionTextWrap}>
                  <Text style={styles.inputOptionName}>{input.name}</Text>
                  <Text style={styles.inputOptionType}>{input.type}</Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable style={styles.inputConfirmButton} onPress={selection.closeList}>
            <Text style={styles.inputConfirmButtonText}>このマイクに決定</Text>
          </Pressable>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.cream,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginTop: 14,
  },
  inputIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.green },
  inputTextWrap: { flex: 1 },
  inputLabel: { color: palette.muted, fontSize: 10, fontWeight: '700' },
  inputName: { color: palette.ink, fontSize: 14, fontWeight: '800', marginTop: 2 },
  inputMeta: { color: palette.muted, fontSize: 10, marginTop: 2 },
  inputAction: {
    backgroundColor: palette.white,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: palette.line,
  },
  inputActionDisabled: { opacity: 0.55 },
  inputActionText: { color: palette.greenDark, fontSize: 12, fontWeight: '800' },
  inputList: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    padding: 10,
    marginTop: 8,
    gap: 7,
  },
  inputListTitle: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  inputOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  inputOptionSelected: { backgroundColor: palette.mint },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: palette.green },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.green },
  inputOptionTextWrap: { flex: 1 },
  inputOptionName: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  inputOptionType: { color: palette.muted, fontSize: 10, marginTop: 2 },
  inputConfirmButton: {
    backgroundColor: palette.green,
    borderRadius: 13,
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 4,
  },
  inputConfirmButtonText: { color: palette.white, fontSize: 14, fontWeight: '800' },
  errorText: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 12,
  },
});
