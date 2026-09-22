import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useApp } from "../core/state";
import * as api from "../core/api";
import { Button, Chip, Empty, Field, Loading, Page } from "../ui/components";
import { s, colors } from "../ui/theme";
import type { Navigation, ScreenProps } from "../navigation-types";

export function RequireAccount({ children }: { children: ReactNode }) {
  const { status, l, restore, error } = useApp();
  const navigation = useNavigation<Navigation>();
  if (status === "loading") return <Loading />;
  if (status === "error")
    return (
      <Page>
        <Empty
          title={l("No pudimos conectar", "Unable to connect")}
          body={
            error === "configuration"
              ? l(
                  "Falta configurar la conexión de esta instalación.",
                  "This installation needs its connection configured.",
                )
              : l(
                  "Revisá tu conexión y volvé a intentar.",
                  "Check your connection and try again.",
                )
          }
          retry={() => void restore()}
        />
      </Page>
    );
  if (status !== "authenticated")
    return (
      <Page>
        <Empty
          title={l("Tu estilo empieza acá", "Your style starts here")}
          body={l(
            "Ingresá para guardar tus conversaciones y descubrir recomendaciones personales.",
            "Sign in to keep your conversations and discover personal recommendations.",
          )}
        />
        <Button
          title={l("Ingresar o crear cuenta", "Sign in or register")}
          onPress={() => navigation.navigate("Auth")}
        />
      </Page>
    );
  return children;
}
export function AuthScreen({ navigation }: ScreenProps<"Auth">) {
  const { accept, l } = useApp();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  async function submit() {
    setError("");
    try {
      const result = register
        ? await api.register(name.trim(), email.trim(), password)
        : await api.login(email.trim(), password);
      setPassword("");
      accept(result);
      navigation.goBack();
    } catch {
      setPassword("");
      setError(
        l(
          "No pudimos ingresar. Revisá tus datos y tu conexión.",
          "Unable to sign in. Check your details and connection.",
        ),
      );
    }
  }
  return (
    <Page>
      <Text style={s.eyebrow}>LOOKEATE</Text>
      <Text style={[s.title, { fontSize: 44, lineHeight: 48 }]}>
        {l("Un espacio para\nser vos.", "A space to\nbe yourself.")}
      </Text>
      <Text style={s.muted}>
        {l(
          "Ideas, prendas y looks que hablan de vos.",
          "Ideas, pieces and looks that feel like you.",
        )}
      </Text>
      <View style={s.row}>
        <Chip
          title={l("Ingresar", "Sign in")}
          selected={!register}
          onPress={() => setRegister(false)}
        />
        <Chip
          title={l("Crear cuenta", "Register")}
          selected={register}
          onPress={() => setRegister(true)}
        />
      </View>
      {register && (
        <Field
          label={l("Nombre", "Name")}
          value={name}
          onChangeText={setName}
          autoComplete="name"
        />
      )}
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Field
        label={l("Contraseña", "Password")}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={register ? "new-password" : "current-password"}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
      <Button
        title={
          register
            ? l("Crear mi cuenta", "Create my account")
            : l("Entrar a Lookeate", "Enter Lookeate")
        }
        disabled={
          !email.includes("@") ||
          password.length < (register ? 8 : 1) ||
          (register && !name.trim())
        }
        onPress={submit}
        icon="arrow-forward"
      />
      <View style={s.divider} />
      <Button
        title={l("Registrar una tienda", "Register a store")}
        secondary
        onPress={() => navigation.navigate("StoreRegister")}
      />
    </Page>
  );
}
