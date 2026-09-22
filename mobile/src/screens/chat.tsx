import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import Markdown from "react-native-markdown-display";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../core/state";
import * as api from "../core/api";
import { useResource } from "../core/use-resource";
import type {
  ChatMessage,
  Conversation,
  SearchPriorityField,
} from "../core/types";
import {
  Button,
  Chip,
  Empty,
  Field,
  Loading,
  Photo,
  confirmDelete,
} from "../ui/components";
import { colors, s } from "../ui/theme";
import { RequireAccount } from "./auth";
import { ProductCard } from "./products";
import type { Navigation, ScreenProps } from "../navigation-types";

export function AssistantScreen() {
  return (
    <RequireAccount>
      <Conversations />
    </RequireAccount>
  );
}
function Conversations() {
  const { l } = useApp();
  const navigation = useNavigation<Navigation>();
  const result = useResource(api.listConversations);
  const [editing, setEditing] = useState<Conversation | null>(null);
  const [title, setTitle] = useState("");
  const reload = result.reload;
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  async function move(id: string, delta: number) {
    const ids = result.data?.map((c) => c.id) ?? [];
    const index = ids.indexOf(id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next], ids[index]];
    await api.reorderConversations(ids);
    await result.reload();
  }
  return (
    <FlatList
      style={s.fill}
      contentContainerStyle={s.page}
      data={result.data ?? []}
      keyExtractor={(c) => c.id}
      refreshing={result.loading}
      onRefresh={() => void result.reload()}
      ListHeaderComponent={
        <View style={{ gap: 18, paddingBottom: 20 }}>
          <Text style={s.eyebrow}>
            {l("TU STYLIST PERSONAL", "YOUR PERSONAL STYLIST")}
          </Text>
          <Text style={s.title}>Lookeate Assistant</Text>
          <Text style={s.muted}>
            {l(
              "Cada gran look empieza con una idea.",
              "Every great look starts with an idea.",
            )}
          </Text>
          <Button
            title={l("Nueva conversación", "New conversation")}
            icon="add"
            onPress={() => navigation.navigate("Chat", {})}
          />
          {editing && (
            <View style={s.card}>
              <Field
                label={l("Título", "Title")}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
              <Button
                title={l("Guardar", "Save")}
                disabled={!title.trim()}
                onPress={async () => {
                  await api.updateConversation(editing.id, {
                    title: title.trim(),
                  });
                  setEditing(null);
                  await result.reload();
                }}
              />
              <Button
                title={l("Cancelar", "Cancel")}
                secondary
                onPress={() => setEditing(null)}
              />
            </View>
          )}
          {result.error && (
            <Empty
              title={l(
                "No pudimos cargar el historial",
                "Could not load history",
              )}
              retry={() => void result.reload()}
            />
          )}
        </View>
      }
      renderItem={({ item, index }) => (
        <View style={[s.card, { marginBottom: 12 }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("Chat", { id: item.id })}
          >
            <Text style={s.heading}>
              {item.is_pinned ? "✦ " : ""}
              {item.title}
            </Text>
            <Text numberOfLines={2} style={s.muted}>
              {item.last_message_preview ??
                l("Lista para empezar", "Ready to start")}
            </Text>
          </Pressable>
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
            <Button
              title={
                item.is_pinned ? l("Desfijar", "Unpin") : l("Fijar", "Pin")
              }
              secondary
              onPress={async () => {
                await api.updateConversation(item.id, {
                  is_pinned: !item.is_pinned,
                });
                await result.reload();
              }}
            />
            <Button
              title={l("Renombrar", "Rename")}
              secondary
              onPress={() => {
                setEditing(item);
                setTitle(item.title);
              }}
            />
            <Button
              title="↑"
              secondary
              disabled={index === 0}
              onPress={() => move(item.id, -1)}
            />
            <Button
              title="↓"
              secondary
              disabled={index === (result.data?.length ?? 0) - 1}
              onPress={() => move(item.id, 1)}
            />
            <Button
              title={l("Eliminar", "Delete")}
              secondary
              onPress={() =>
                confirmDelete(
                  l("Eliminar conversación", "Delete conversation"),
                  item.title,
                  async () => {
                    await api.deleteConversation(item.id);
                    await result.reload();
                  },
                  l("Cancelar", "Cancel"),
                  l("Eliminar", "Delete"),
                )
              }
            />
          </ScrollView>
        </View>
      )}
      ListEmptyComponent={
        !result.loading && !result.error ? (
          <Empty
            title={l(
              "Hablemos de tu próximo look",
              "Let’s talk about your next look",
            )}
            body={l(
              "Pedí ideas para una ocasión o compartí una foto.",
              "Ask for ideas for an occasion or share a photo.",
            )}
          />
        ) : result.loading ? (
          <Loading />
        ) : null
      }
    />
  );
}
export function ChatScreen(props: ScreenProps<"Chat">) {
  return (
    <RequireAccount>
      <Chat {...props} />
    </RequireAccount>
  );
}
function Chat({ route, navigation }: ScreenProps<"Chat">) {
  const insets = useSafeAreaInsets();
  const { l, preferences } = useApp();
  const [id, setId] = useState(route.params.id);
  const [content, setContent] = useState("");
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [settings, setSettings] = useState(false);
  const [notes, setNotes] = useState("");
  const [personalized, setPersonalized] = useState<boolean | null>(null);
  const [priority, setPriority] = useState<SearchPriorityField[] | null>(null);
  const mounted = useRef(true);
  const sendingRef = useRef(false);
  const list = useRef<FlatList<ChatMessage>>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const loader = useCallback(
    () => (id ? api.listMessages(id) : Promise.resolve([])),
    [id],
  );
  const messages = useResource(loader);
  const conversationLoader = useCallback(
    () => (id ? api.getConversation(id) : Promise.resolve(null)),
    [id],
  );
  const conversation = useResource(conversationLoader);
  function openSettings() {
    if (conversation.data) {
      setNotes(
        conversation.data.style_preferences.temporary.freeform_notes ?? "",
      );
      setPersonalized(
        conversation.data.style_preferences.use_personalized_styles,
      );
      setPriority(conversation.data.search_preferences.priority_fields);
    }
    setSettings(!settings);
  }
  async function pick(camera: boolean) {
    if (
      camera &&
      !(await ImagePicker.requestCameraPermissionsAsync()).granted
    ) {
      Alert.alert(
        l("Permiso de cámara", "Camera permission"),
        l(
          "Podés habilitar la cámara desde Ajustes o elegir una foto de tu galería.",
          "Enable camera access in Settings or select a photo from your library.",
        ),
      );
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.8,
    };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync({
          ...options,
          allowsMultipleSelection: true,
          selectionLimit: Math.max(1, 3 - images.length),
        });
    if (!result.canceled)
      setImages((current) => [...current, ...result.assets].slice(0, 3));
  }
  async function send() {
    if (sendingRef.current || (!content.trim() && !images.length)) return;
    sendingRef.current = true;
    setSending(true);
    setSendError(false);
    let activeId = id;
    try {
      if (!activeId) {
        activeId = (await api.createConversation()).id;
        if (mounted.current) {
          setId(activeId);
          navigation.setParams({ id: activeId });
        }
      }
      const result = await api.sendMessage(activeId, content.trim(), images);
      if (mounted.current) {
        messages.setData((current) => [
          ...(current ?? []).filter(
            (m) =>
              m.id !== result.user_message.id &&
              m.id !== result.assistant_message.id,
          ),
          result.user_message,
          result.assistant_message,
        ]);
        setContent("");
        setImages([]);
      }
    } catch {
      if (mounted.current) {
        setSendError(true);
        if (activeId) {
          try {
            const history = await api.listMessages(activeId);
            if (mounted.current) messages.setData(history);
          } catch {
            /* Keep the uncertain-delivery notice and draft for recovery. */
          }
        }
      }
    } finally {
      sendingRef.current = false;
      if (mounted.current) setSending(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={s.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Button
          title={
            settings
              ? l("Volver al chat", "Back to chat")
              : l(
                  "Preferencias de esta conversación",
                  "Conversation preferences",
                )
          }
          secondary
          onPress={openSettings}
        />
      </View>
      {settings ? (
        <ScrollView contentContainerStyle={s.page}>
          <Text style={s.heading}>
            {l("Estilo para esta conversación", "Style for this conversation")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {([null, true, false] as const).map((value) => (
              <Chip
                key={String(value)}
                title={
                  value === null
                    ? l("Heredar", "Inherit")
                    : value
                      ? l("Personalizar", "Personalize")
                      : l("Ignorar memoria", "Ignore memory")
                }
                selected={personalized === value}
                onPress={() => setPersonalized(value)}
              />
            ))}
          </View>
          <Field
            label={l("Notas temporales", "Temporary notes")}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <Text style={s.heading}>
            {l("Prioridad de búsqueda", "Search priority")}
          </Text>
          <Chip
            title={l(
              "Heredar prioridad de mi cuenta",
              "Inherit account priority",
            )}
            selected={priority === null}
            onPress={() => setPriority(null)}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(
              [
                "category",
                "gender",
                "base_colors",
                "secondary_colors",
                "season",
                "max_price",
              ] as const
            ).map((field) => (
              <Chip
                key={field}
                title={field.replaceAll("_", " ")}
                selected={priority?.includes(field)}
                onPress={() =>
                  setPriority((current) =>
                    current?.includes(field)
                      ? current.filter((f) => f !== field)
                      : [...(current ?? []), field],
                  )
                }
              />
            ))}
          </View>
          <Button
            title={l("Guardar para este chat", "Save for this chat")}
            disabled={!id}
            onPress={async () => {
              await api.updateConversationStylePreferences(id!, {
                use_personalized_styles: personalized,
                temporary: { freeform_notes: notes.trim() || null },
              });
              await api.updateConversationSearchPreferences(id!, priority);
              setSettings(false);
            }}
          />
          {!id && (
            <Text style={s.muted}>
              {l(
                "Enviá el primer mensaje para guardar preferencias.",
                "Send the first message to save preferences.",
              )}
            </Text>
          )}
        </ScrollView>
      ) : (
        <FlatList
          ref={list}
          style={{ flex: 1 }}
          contentContainerStyle={[
            s.page,
            { gap: preferences.compactChat ? 10 : 22 },
          ]}
          data={messages.data ?? []}
          keyExtractor={(m) => m.id}
          onContentSizeChange={() =>
            list.current?.scrollToEnd({ animated: true })
          }
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <Message message={item} />}
          ListHeaderComponent={
            messages.error ? (
              <Empty
                title={l(
                  "No pudimos cargar los mensajes",
                  "Could not load messages",
                )}
                retry={() => void messages.reload()}
              />
            ) : null
          }
          ListEmptyComponent={
            messages.loading ? (
              <Loading />
            ) : (
              <View style={{ gap: 20, paddingTop: 36 }}>
                <Text style={s.title}>
                  {l(
                    "¿Qué tenés\nen mente hoy?",
                    "What’s on\nyour mind today?",
                  )}
                </Text>
                {[
                  l("Un look para una cena", "An outfit for dinner"),
                  l("Cómo combinar mis zapatillas", "How to style my sneakers"),
                  l(
                    "Ideas para renovar mi estilo",
                    "Ideas to refresh my style",
                  ),
                ].map((idea) => (
                  <Button
                    key={idea}
                    title={idea}
                    secondary
                    onPress={() => setContent(idea)}
                  />
                ))}
              </View>
            )
          }
          ListFooterComponent={
            sending ? (
              <View style={s.row}>
                <Loading />
                <Text style={s.muted}>
                  {l("Pensando tu look…", "Thinking about your look…")}
                </Text>
              </View>
            ) : null
          }
        />
      )}
      {sendError && (
        <View style={{ padding: 12 }}>
          <Text accessibilityRole="alert" style={{ color: colors.danger }}>
            {l(
              "No pudimos confirmar el envío. Revisá el historial antes de volver a enviar.",
              "Could not confirm delivery. Check the history before sending again.",
            )}
          </Text>
        </View>
      )}
      <View
        style={{
          padding: 12,
          paddingBottom: Math.max(insets.bottom, 12),
          gap: 10,
          borderTopWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.bg,
        }}
      >
        {images.length > 0 && (
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
            {images.map((image, index) => (
              <View key={`${image.uri}-${index}`} style={{ width: 85, gap: 4 }}>
                <Photo uri={image.uri} size={70} />
                <Button
                  title="×"
                  disabled={sending}
                  secondary
                  onPress={() =>
                    setImages((v) => v.filter((_, i) => i !== index))
                  }
                />
              </View>
            ))}
          </ScrollView>
        )}
        <TextInput
          accessibilityLabel={l("Mensaje", "Message")}
          placeholder={l(
            "Contame qué estás buscando…",
            "Tell me what you’re looking for…",
          )}
          placeholderTextColor={colors.muted}
          multiline
          value={content}
          editable={!sending}
          onChangeText={setContent}
          maxLength={12000}
          style={[s.input, { maxHeight: 130 }]}
        />
        <View style={s.spread}>
          <View style={s.row}>
            <Button
              title={l("Foto", "Photo")}
              icon="images-outline"
              iconOnly
              secondary
              disabled={sending || images.length >= 3}
              onPress={() => pick(false)}
            />
            <Button
              title={l("Cámara", "Camera")}
              icon="camera-outline"
              iconOnly
              secondary
              disabled={sending || images.length >= 3}
              onPress={() => pick(true)}
            />
          </View>
          <Button
            title={l("Enviar", "Send")}
            disabled={sending || (!content.trim() && !images.length)}
            onPress={send}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
function Message({ message }: { message: ChatMessage }) {
  const { l, preferences } = useApp();
  const navigation = useNavigation<Navigation>();
  const recommendations = message.final_response_payload?.recommendations;
  return (
    <View
      style={[
        s.card,
        {
          backgroundColor:
            message.role === "user" ? colors.soft : colors.surface,
          padding: preferences.compactChat ? 12 : 18,
        },
      ]}
    >
      <Text style={s.eyebrow}>
        {message.role === "user" ? l("VOS", "YOU") : "LOOKEATE ASSISTANT"}
      </Text>
      {message.attachments?.map((a) => (
        <Photo key={a.id} uri={a.data_url} size={200} />
      ))}
      <Markdown
        style={{
          body: { color: colors.text, fontSize: 16, lineHeight: 24 },
          link: { color: colors.accent },
          code_inline: { backgroundColor: colors.high, color: colors.text },
          fence: { backgroundColor: colors.high, color: colors.text },
        }}
        onLinkPress={(url) => {
          if (/^https?:\/\//i.test(url))
            void Linking.openURL(url).catch(() => {});
          return false;
        }}
      >
        {message.content}
      </Markdown>
      {preferences.showRecommendations && recommendations && (
        <View style={{ gap: 14 }}>
          {recommendations.outfits.map((outfit, index) => (
            <Button
              key={index}
              title={outfit.summary_label}
              secondary
              icon="shirt-outline"
              onPress={() => navigation.navigate("Outfit", { outfit })}
            />
          ))}
          {recommendations.garments.map((garment, i) => (
            <View key={i} style={{ gap: 8 }}>
              <Text style={s.heading}>{garment.summary_label}</Text>
              {(garment.best_match
                ? [garment.best_match]
                : garment.product_highlights
              ).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </View>
          ))}
          {recommendations.product_highlights.map((group, i) => (
            <View key={i} style={{ gap: 8 }}>
              <Text style={s.heading}>{group.group_label}</Text>
              {group.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
