// Fills the site footer's contact details from site_config.contact, so the
// footer stays in sync with what's set in the admin Contact editor.
document.addEventListener("DOMContentLoaded", async () => {
  let config;
  try {
    config = await DataService.getConfig();
  } catch (e) {
    return; // leave the static footer as-is if offline
  }
  const c = (config && config.contact) || {};
  document.querySelectorAll('[data-footer="phone"]').forEach((el) => {
    if (c.phone) el.textContent = c.phone;
  });
  document.querySelectorAll('[data-footer="address"]').forEach((el) => {
    if (c.address) el.textContent = c.address.replace(/\n/g, ", ");
  });
});
