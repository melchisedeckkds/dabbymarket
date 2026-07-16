import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

// Sur le web (navigateur), il n'y a pas de retour haptique natif — on ne
// fait rien silencieusement. Sur Android/iOS empaquetés via Capacitor, une
// vraie vibration légère est déclenchée, ce qui rend les interactions clés
// (coup de cœur, boost, confirmation) nettement plus satisfaisantes au
// toucher, à la manière d'Instagram ou TikTok.
export async function hapticLight() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* pas grave si indisponible sur l'appareil */
  }
}

export async function hapticMedium() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    /* pas grave si indisponible sur l'appareil */
  }
}

export async function hapticSuccess() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    /* pas grave si indisponible sur l'appareil */
  }
}
