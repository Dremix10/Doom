// A tappable control that opens an iOS-style menu, the way Mail switches
// mailboxes or Health switches charts. Two shapes:
//
//   variant="title"  the screen's large title (who the board is about)
//   variant="pill"   a compact button (what's being ranked)
//
// Split that way because one menu holding groups + ranking + period ran to 13
// rows and scrolled, which made flipping a two-option period cost exactly as much
// as picking a group. Two short menus, each about its own kind of choice.
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Palette, T, S, R, CONTINUOUS, HAIRLINE, MIN_TAP, useColors, useStyles } from '../lib/theme';

export type MenuItem = { id: string; label: string; detail?: string; action?: boolean };
export type MenuSection = { id: string; title: string; items: MenuItem[]; selected: string };

type Props = {
  label: string;
  sections: MenuSection[];
  onSelect: (sectionId: string, itemId: string) => void;
  variant?: 'title' | 'pill';
  /** Which edge the menu hangs from. A pill near the right edge must open
   *  rightwards or the sheet runs off screen. */
  align?: 'left' | 'right';
};

export function TitleMenu({ label, sections, onSelect, variant = 'title', align = 'left' }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const C = useColors();
  const s = useStyles(makeStyles);
  const ref = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: S.gutter, y: 96, w: 0 });

  const show = () => {
    ref.current?.measureInWindow?.((x, y, w, h) => {
      if (typeof y === 'number') setAnchor({ x: x || S.gutter, y: y + (h || 40) + 6, w: w || 0 });
    });
    setOpen(true);
  };

  const choose = (sectionId: string, itemId: string) => {
    setOpen(false);
    onSelect(sectionId, itemId);
  };

  const pill = variant === 'pill';
  const position = align === 'right'
    ? { right: Math.max(S.gutter, width - (anchor.x + anchor.w)) }
    : { left: anchor.x };

  return (
    <>
      <Pressable
        ref={ref}
        onPress={show}
        style={({ pressed }) => [pill ? s.pill : s.trigger, pressed && { opacity: 0.6 }]}
      >
        <Text style={pill ? s.pillText : s.title} numberOfLines={1}>{label}</Text>
        <View style={pill ? undefined : s.caret}>
          <Icon name="chevronDown" size={pill ? 14 : 20} color={pill ? C.dim : C.dim} />
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={[s.sheet, position, { top: Math.max(anchor.y, insets.top + S.sm) }]}>
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

const makeStyles = (C: Palette) => StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: S.sm - 2 },
  title: { ...T.largeTitle, color: C.text, flexShrink: 1 },
  caret: { marginTop: 4 },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: S.xs + 1,
    backgroundColor: C.card, borderRadius: R.full,
    borderWidth: HAIRLINE, borderColor: C.line,
    paddingLeft: S.md, paddingRight: S.sm + 2, paddingVertical: 7,
  },
  pillText: { ...T.footnote, color: C.text, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute', minWidth: 232, maxWidth: 320, maxHeight: 440,
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
