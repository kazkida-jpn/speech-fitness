import { Text, View } from 'react-native';

import { LegalPageShell, legalStyles } from '@/components/LegalPage';
import { TOKUSHOHO_ROWS, TOKUSHOHO_TITLE } from '@/content/tokushoho';

export default function LegalScreen() {
  return (
    <LegalPageShell
      title={TOKUSHOHO_TITLE}
      lead="特定商取引に関する法律第11条に基づき、通信販売に関する事項を次のとおり表示します。">
      <View style={{ marginTop: 18 }}>
        {TOKUSHOHO_ROWS.map((row) => (
          <View key={row.label} style={legalStyles.row}>
            <Text style={legalStyles.rowLabel}>{row.label}</Text>
            <Text style={legalStyles.rowValue}>{row.value}</Text>
          </View>
        ))}
      </View>
    </LegalPageShell>
  );
}
