// Fills the contact page from site_config.contact (managed in the admin panel).
// Falls back silently to the static markup if Supabase is unavailable.
document.addEventListener("DOMContentLoaded", async () => {
  let config;
  try {
    config = await DataService.getConfig();
  } catch (err) {
    console.error("Contact: failed to load config:", err);
    return;
  }
  const c = (config && config.contact) || {};

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el && val != null && val !== "") el.textContent = val;
  };
  const setHref = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.href = val;
  };

  setText("ct-eyebrow", c.eyebrow);
  setText("ct-headline", c.headline);
  setText("ct-intro", c.intro);
  setText("ct-address", c.address);
  setText("ct-hours-weekday", c.hours_weekday);
  setText("ct-hours-saturday", c.hours_saturday);

  if (c.phone) {
    const tel = "tel:" + c.phone.replace(/\s+/g, "");
    ["ct-phone", "ct-phone2"].forEach((id) => {
      setText(id, c.phone);
      setHref(id, tel);
    });
  }

  if (c.email) {
    setText("ct-email", c.email);
    setHref("ct-email", "mailto:" + c.email);
  }

  if (c.whatsapp_number) {
    const msg = encodeURIComponent(
      "Hi, I'd like to know more about your instruments."
    );
    const wa = `https://wa.me/${c.whatsapp_number}?text=${msg}`;
    ["ct-whatsapp-1", "ct-whatsapp-2", "ct-whatsapp-info"].forEach((id) =>
      setHref(id, wa)
    );
  }

  setHref("ct-instagram", c.instagram_url);
  setHref("ct-facebook", c.facebook_url);
});
