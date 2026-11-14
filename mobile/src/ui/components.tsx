import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, s } from "./theme";
import { useApp } from "../core/state";
import { ApiError } from "../core/transport";

export function Button({
  title,
  onPress,
  secondary,
  disabled,
  icon,
  iconOnly,
}: {
  title: string;
  onPress(): void | Promise<void>;
  secondary?: boolean;
  disabled?: boolean;
  iconOnly?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const [busy, setBusy] = useState(false);
  const { l } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={async () => {
        setBusy(true);
        try {
          await onPress();
        } catch (error) {
          Alert.alert(
            l("No se pudo completar", "Could not complete"),
            error instanceof ApiError && error.status === 422
              ? l("Revisá los datos del formulario.", "Check the form values.")
              : error instanceof ApiError && error.status === 403
                ? l(
                    "Tu cuenta no puede realizar esta acción.",
                    "Your account cannot perform this action.",
                  )
                : error instanceof ApiError && error.status === 429
                  ? l(
                      "Esperá un momento antes de intentarlo otra vez.",
                      "Wait a moment before trying again.",
                    )
                  : l(
                      "Revisá tu conexión e intentá nuevamente.",
                      "Check your connection and try again.",
                    ),
          );
        } finally {
          setBusy(false);
        }
      }}
      style={({ pressed }) => [
        s.button,
        secondary && {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
        },
        { opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.accent : colors.bg} />
      ) : icon ? (
        <Ionicons
          name={icon}
          size={19}
          color={secondary ? colors.text : colors.bg}
        />
      ) : null}
      {!iconOnly && (
        <Text
          style={{
            color: secondary ? colors.text : colors.bg,
            fontWeight: "700",
            fontSize: 14,
            flexShrink: 1,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 100, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Page({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={s.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 56}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.page,
          {
            paddingLeft: 16 + insets.left,
            paddingRight: 16 + insets.right,
            paddingBottom: Math.max(24, insets.bottom + 16),
          },
        ]}
        keyboardDismissMode="on-drag"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function ScreenHeading({
  title,
  eyebrow,
  description,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      {eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}
      <Text accessibilityRole="header" style={s.title}>
        {title}
      </Text>
      {description && <Text style={s.muted}>{description}</Text>}
    </View>
  );
}

// Native modal provides focus isolation and Android back dismissal. Content scrolls
// independently, so long forms never push their originating list out of reach.
export function Sheet({
  title,
  visible,
  onClose,
  children,
}: {
  title: string;
  visible: boolean;
  onClose(): void;
  children: ReactNode;
}) {
  const { l } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[s.fill, { paddingTop: insets.top }]}
        accessibilityViewIsModal
      >
        <View
          style={[
            s.spread,
            { padding: 16, borderBottomWidth: 1, borderColor: colors.line },
          ]}
        >
          <Text accessibilityRole="header" style={[s.heading, { flex: 1 }]}>
            {title}
          </Text>
          <Button
            title={l("Cerrar", "Close")}
            icon="close"
            iconOnly
            secondary
            onPress={onClose}
          />
        </View>
        <Page>{children}</Page>
      </View>
    </Modal>
  );
}

export function Disclosure({
  title,
  children,
  initiallyOpen = false,
}: {
  title: string;
  children: ReactNode;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={{ gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[s.spread, { minHeight: 48 }]}
      >
        <Text style={[s.text, { flex: 1, fontWeight: "600" }]}>{title}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.accent}
        />
      </Pressable>
      {open && children}
    </View>
  );
}
export function Chip({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected?: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        s.chip,
        selected && {
          backgroundColor: colors.soft,
          borderColor: colors.accent,
        },
      ]}
    >
      <Text
        style={{ color: selected ? colors.accent : colors.muted, fontSize: 13 }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Empty({
  title,
  body,
  retry,
}: {
  title: string;
  body?: string;
  retry?: () => void;
}) {
  const { l } = useApp();
  return (
    <View style={[s.card, { marginVertical: 14 }]}>
      <Ionicons
        name={retry ? "cloud-offline-outline" : "sparkles-outline"}
        color={colors.accent}
        size={28}
      />
      <Text style={s.heading}>{title}</Text>
      {body && <Text style={s.muted}>{body}</Text>}
      {retry && (
        <Button title={l("Reintentar", "Retry")} onPress={retry} secondary />
      )}
    </View>
  );
}
export function Photo({
  uri,
  size = 160,
}: {
  uri?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed)
    return (
      <View
        style={{
          height: size,
          width: "100%",
          backgroundColor: colors.high,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
        }}
      >
        <Ionicons name="shirt-outline" size={36} color={colors.muted} />
      </View>
    );
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={{ uri }}
      onError={() => setFailed(true)}
      style={{
        height: size,
        width: "100%",
        borderRadius: 14,
        backgroundColor: "#eeeae6",
      }}
      resizeMode="contain"
    />
  );
}
export function Loading() {
  return (
    <ActivityIndicator
      accessibilityLabel="Loading"
      color={colors.accent}
      style={{ padding: 32 }}
    />
  );
}
export function confirmDelete(
  title: string,
  body: string,
  action: () => Promise<void>,
  cancel: string,
  remove: string,
) {
  Alert.alert(title, body, [
    { text: cancel, style: "cancel" },
    {
      text: remove,
      style: "destructive",
      onPress: () => {
        void action().catch(() => Alert.alert(title, "Error."));
      },
    },
  ]);
}
