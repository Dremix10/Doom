// A tappable large title that opens an iOS-style menu, the way Mail switches
// mailboxes or Health switches charts. Preferred over a corner gear because the
// title itself shows the current selection without being opened — and because a
// gear on this screen would collide with the Setup tab's gear.
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { C, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP } from '../lib/theme';

export type MenuItem = { id: string; label: string; detail?: string; action?: boolean };
export type MenuSection = { id: string; title: string; items: MenuItem[]; selected: string };

type Props = {
  label: string;
  sections: MenuSection[];
  onSelect: (sectionId: string, itemId: string) => void;
};

export function TitleMenu({ label, sections, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const ref = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: S.gutter, y: 96 });

  const show = () => {
    // Anchor the sheet under the title. If measurement isn't available yet we
    // fall back to the gutter, which is where the title sits anyway.
    ref.current?.measureInWindow?.((x, y, _w, h) => {
      if (typeof y === 'number') setAnchor({ x: x || S.gutter, y: y + (h || 40) + 6 });
    });
    setOpen(true);
  };

  const choose = (sectionId: string, itemId: string) => {
    setOpen(false);
    onSelect(sectionId, itemId);
  };

  return (
    <>
      <Pressable ref={ref} onPress={show} style={({ pressed }) => [s.trigger, pressed && { opacity: 0.6 }]}>
        <Text style={s.title}>{label}</Text>
        <View style={s.caret}>
          <Icon name="chevronDown" size={20} color={C.dim} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[s.sheet, {
              left: anchor.x,
              top: Math.max(anchor.y, insets.top + S.sm),
            }]}
          >
            <ScrollView bounces={false}>
              {sections.map((section, i) => (
                <View key={section.id}>
                  <Text style={[s.sectionTitle, i > 0 && s.sectionTitleSpaced]}>{section.title}</Text>
                  {section.items.map((item) => {
                    const selected = item.id === section.selected;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => choose(section.id, item.id)}
                        style={({ pressed }) => [s.row, pressed && { backgroundColor: C.line }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[s.rowLabel, (selected || item.action) && { color: C.accent }]}>
                            {item.label}
                          </Text>
                          {!!item.detail && <Text style={s.rowDetail}>{item.detail}</Text>}
                        </View>
                        {selected && !item.action && <Icon name="check" size={18} color={C.accent} />}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: S.sm - 2 },
  title: { ...T.largeTitle, color: C.text },
  caret: { marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute', minWidth: 258, maxWidth: 320, maxHeight: 440,
    backgroundColor: C.card2, borderRadius: R.lg, ...CONTINUOUS,
    borderWidth: HAIRLINE, borderColor: C.line, paddingVertical: S.xs + 2,
    boxShadow: '0 12px 24px rgba(0,0,0,0.45)',
  },
  sectionTitle: {
    ...T.caption, fontWeight: '600', color: C.faint, textTransform: 'uppercase',
    letterSpacing: 0.6, paddingHorizontal: S.lg, paddingTop: S.sm, paddingBottom: S.xs,
  },
  sectionTitleSpaced: { marginTop: S.sm, borderTopWidth: HAIRLINE, borderTopColor: C.line, paddingTop: S.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    paddingHorizontal: S.lg, minHeight: MIN_TAP,
  },
  rowLabel: { ...T.body, color: C.text },
  rowDetail: { ...T.caption, color: C.faint, marginTop: 1 },
});
