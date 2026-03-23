/** en-keys order indices 200–299 */
export default [
  ["Uji model ini", "Uji model ini", "ทดสอบโมเดลนี้"],
  ["Simpan ke konfig", "Simpan ke konfigurasi", "บันทึกลงคอนฟิก"],
  ["Jalankan ujian berjaya sebelum simpan", "Jalankan uji berhasil sebelum simpan", "รันทดสอบให้สำเร็จก่อนบันทึก"],
  ["Disimpan ke konfig", "Disimpan ke konfigurasi", "บันทึกลงคอนฟิกแล้ว"],
  [
    'Tambah "{ref}" ke agents.defaults.model.fallbacks (dilangkau jika sama dengan utama).',
    'Menambahkan "{ref}" ke agents.defaults.model.fallbacks (dilewati jika sama dengan primer).',
    'เพิ่ม "{ref}" ใน agents.defaults.model.fallbacks (ข้ามหากตรงกับหลัก)',
  ],
  [
    'Tetapkan agents.list "{agentId}".model kepada "{ref}" dan gabung alias agents.defaults.models (JSON sah).',
    'Atur entri agents.list "{agentId}".model ke "{ref}" dan gabung alias agents.defaults.models (JSON valid).',
    'ตั้ง agents.list รายการ "{agentId}".model เป็น "{ref}" และรวม alias agents.defaults.models (JSON ถูกต้อง)',
  ],
  ["Semasa defaults.fallbacks: {list}", "Saat ini defaults.fallbacks: {list}", "defaults.fallbacks ปัจจุบัน: {list}"],
  ["Simpan gagal", "Simpan gagal", "บันทึกไม่สำเร็จ"],
  ["(fail konfig untuk senarai: {path})", "(file konfigurasi untuk daftar: {path})", "(ไฟล์คอนฟิกสำหรับรายการ: {path})"],
  ["Batal", "Batal", "ยกเลิก"],
  ["Dicadangkan daripada ID model", "Disarankan dari ID model", "แนะนำจากรหัสโมเดล"],
  ["Gunakan cadangan", "Terapkan saranan", "ใช้ค่าที่แนะนำ"],
  ["Gunakan nilai rujukan", "Terapkan nilai referensi", "ใช้ค่าอ้างอิง"],
  [
    "Masukkan ID model di atas dahulu. Kami tunjukkan cadangan tetingkap konteks dan output maks berdasarkan petunjuk siri dalam ID (cth. gemini, gpt-5, claude). Nilai ini hanya untuk metadata openclaw.json dan tidak mengubah cara ujian LiteLLM.",
    "Masukkan ID model di atas terlebih dahulu. Kami menampilkan saran jendela konteks dan output maks berdasarkan petunjuk seri dalam ID (mis. gemini, gpt-5, claude). Nilai ini hanya untuk metadata openclaw.json dan tidak mengubah cara probing LiteLLM.",
    "ใส่รหัสโมเดลด้านบนก่อน จากนั้นเราจะแสดงหน้าต่างบริบทและเอาต์พุตสูงสุดตามคำใบ้ในชื่อรุ่น (เช่น gemini, gpt-5, claude) ค่าเหล่านี้ใช้สำหรับ metadata ของ openclaw.json เท่านั้น ไม่เปลี่ยนวิธี probing ของ LiteLLM",
  ],
  [
    "Tiada siri dikenali; nilai di bawah anggaran konservatif—sahkan dengan dokumen LiteLLM atau vendor sebelum guna.",
    "Tidak ada seri yang cocok; nilai di bawah perkiraan konservatif—verifikasi dengan dokumen LiteLLM atau vendor sebelum menerapkan.",
    "ไม่พบชื่อรุ่นที่รู้จัก ค่าด้านล่างเป็นการประมาณอย่างระมัดระวัง—โปรดตรวจกับเอกสาร LiteLLM หรือผู้ขายก่อนใช้",
  ],
  ["Masukkan ID model dahulu", "Masukkan ID model terlebih dahulu", "ใส่รหัสโมเดลก่อน"],
  ["Kunci API sementara (pilihan)", "Kunci API sementara (opsional)", "คีย์ API ชั่วคราว (ไม่บังคับ)"],
  [
    "Hanya untuk ujian sesi ini; tidak disimpan ke konfig",
    "Hanya untuk ujian sesi ini; tidak disimpan ke konfigurasi",
    "สำหรับการทดสอบในเซสชันนี้เท่านั้น ไม่บันทึกลงคอนฟิก",
  ],
  [
    "Untuk nyahpepijat dalaman: tampal token Bearer jika konfig/env belum ada kunci sah. Dihantar hanya dengan permintaan Ujian / praujian simpan ke pelayan apl ini—tidak ditulis ke openclaw.json atau storan pelayar. Untuk api openai-completions atau anthropic-messages; fallback CLI openclaw mengabaikan medan ini. Jangan tampal rahsia sebenar di saluran awam.",
    "Untuk debugging internal: tempel token Bearer jika konfig/env belum memiliki kunci valid. Hanya dikirim dengan permintaan Uji / pra-simpan ke server aplikasi ini—tidak pernah ditulis ke openclaw.json atau penyimpanan browser. Untuk api openai-completions atau anthropic-messages; fallback CLI openclaw mengabaikan bidang ini. Jangan tempel rahasia asli di saluran publik.",
    "สำหรับดีบักภายใน: วาง Bearer token หากคอนฟิก/สภาพแวดล้อมยังไม่มีคีย์ที่ใช้ได้ ส่งเฉพาะคำขอทดสอบ/ก่อนบันทึกไปยังเซิร์ฟเวอร์แอปนี้เท่านั้น—ไม่เขียนลง openclaw.json หรือที่เก็บเบราว์เซอร์ ใช้กับ api openai-completions หรือ anthropic-messages; การ fallback ของ openclaw CLI จะไม่ใช้ฟิลด์นี้ อย่าวางความลับจริงในช่องทางสาธารณะ",
  ],
  ["Kosongkan", "Hapus", "ล้าง"],
  ["Pratetap ujian (JSON: URL / protokol / kunci)", "Preset uji (JSON: URL / protokol / kunci)", "พรีเซ็ตการทดสอบ (JSON: URL / โปรโตคอล / คีย์)"],
  ['Tiada (guna konfig setiap pembekal)', "Tidak ada (gunakan konfigurasi tiap penyedia)", "ไม่มี (ใช้คอนฟิกของแต่ละผู้ให้บริการ)"],
  [
    "Tiada pratetap dimuatkan: salin model-probe-presets.example.json ke model-probe-presets.json di akar projek atau ~/.openclaw, atau tambah tatasusunan modelProbePresets.presets dalam openclaw.json.",
    "Tidak ada preset yang dimuat: salin model-probe-presets.example.json ke model-probe-presets.json di root proyek atau ~/.openclaw, atau tambahkan array modelProbePresets.presets di openclaw.json.",
    "ยังไม่โหลดพรีเซ็ต: คัดลอก model-probe-presets.example.json เป็น model-probe-presets.json ที่รากโปรเจ็กต์หรือ ~/.openclaw หรือเพิ่มอาร์เรย์ modelProbePresets.presets ใน openclaw.json",
  ],
  [
    '"Uji semua" sentiasa guna tetapan setiap pembekal, bukan pratetap ini. Ujian baris tunggal dan tambah model guna pratetap terpilih.',
    '"Uji semua" selalu menggunakan pengaturan per penyedia, bukan preset ini. Uji baris tunggal dan tambah-model memakai preset yang dipilih.',
    "\"ทดสอบทั้งหมด\" ใช้การตั้งค่ารายผู้ให้บริการเสมอ ไม่ใช่พรีเซ็ตนี้ การทดสอบทีละแถวและเพิ่มโมเดลใช้พรีเซ็ตที่เลือก",
  ],
  [
    "Pratetap tidak boleh disunting sebaris di sini; sunting model-probe-presets.json atau modelProbePresets dalam openclaw.json, kemudian muat semula. Ujian tambah model dalam mod pembekal OpenClaw guna sumber sama apabila pratetap bar alat dipilih.",
    "Preset tidak dapat diedit inline di sini; edit model-probe-presets.json atau modelProbePresets di openclaw.json, lalu segarkan. Uji tambah-model dalam mode penyedia OpenClaw memakai sumber yang sama saat preset toolbar dipilih.",
    "แก้พรีเซ็ตที่นี่แบบอินไลน์ไม่ได้ แก้ model-probe-presets.json หรือ modelProbePresets ใน openclaw.json แล้วรีเฟรช การทดสอบเพิ่มโมเดลในโหมดผู้ให้บริการ OpenClaw ใช้แหล่งเดียวกันเมื่อเลือกพรีเซ็ตในแถบเครื่องมือ",
  ],
  [
    '"Simpan ke konfig" menampal openclaw.json: models.providers + defaults.model.fallbacks secara lalai. Bar "Tiada" = hanya fallback; ejen tertentu juga mengemas kini model item agents.list tersebut dan alias agents.defaults.models. Merah = tulisan gagal.',
    '"Simpan ke konfigurasi" menambal openclaw.json: models.providers + defaults.model.fallbacks secara default. Toolbar "Tidak ada" = hanya fallback; agen tertentu juga memperbarui model item agents.list tersebut dan alias agents.defaults.models. Merah = penulisan gagal.',
    "\"บันทึกลงคอนฟิก\" แพตช์ openclaw.json: models.providers + defaults.model.fallbacks ตามค่าเริ่มต้น แถบ \"ไม่มี\" = เฉพาะ fallback เอเจนต์เฉพาะยังอัปเดตโมเดลของรายการ agents.list และ alias agents.defaults.models สีแดง = เขียนไม่สำเร็จ",
  ],
  ["Ejen (gabungan ujian + ikatan simpan)", "Agen (gabungan uji + ikatan simpan)", "เอเจนต์ (รวมการทดสอบและการผูกบันทึก)"],
  [
    "Tiada (hanya fallback global; tiada ikatan agents.list)",
    "Tidak ada (hanya fallback global; tanpa ikatan agents.list)",
    "ไม่มี (เฉพาะ fallback ทั่วโลก ไม่ผูก agents.list)",
  ],
  [
    '"Tiada": uji tanpa gabungan models.json setiap ejen. Ejen tertentu: gabung folder itu. Semasa simpan: "Tiada" hanya menambah fallback; ejen menetapkan agents.list[].model kepada provider/modelId dan menggabung { "alias": "…" } di bawah agents.defaults.models.',
    '"Tidak ada": uji tanpa penggabungan models.json per agen. Agen tertentu: gabung folder itu. Saat simpan: "Tidak ada" hanya menambahkan fallback; agen mengatur agents.list[].model ke provider/modelId dan menggabung { "alias": "…" } di bawah agents.defaults.models.',
    "\"ไม่มี\": ทดสอบโดยไม่รวม models.json ต่อเอเจนต์ เอเจนต์เฉพาะ: รวมโฟลเดอร์นั้น เมื่อบันทึก: \"ไม่มี\" เพิ่มเฉพาะ fallback เอเจนต์ตั้ง agents.list[].model เป็น provider/modelId และรวม { \"alias\": \"…\" } ภายใต้ agents.defaults.models",
  ],
  [
    "Tidak menulis agents/*/agent/models.json—hanya openclaw.json melalui Gateway. Bentuk mematuhi JSON ketat (kunci berpetik, tiada komen).",
    "Tidak menulis agents/*/agent/models.json—hanya openclaw.json melalui Gateway. Bentuk mengikuti JSON ketat (kunci berkutip, tanpa komentar).",
    "ไม่เขียน agents/*/agent/models.json—มีเฉพาะ openclaw.json ผ่าน Gateway รูปแบบเป็น JSON เข้มงวด (คีย์มีเครื่องหมายคำพูด ไม่มีคอมเมนต์)",
  ],
  ["Cara untuk menguji", "Cara menguji", "วิธีทดสอบ"],
  ["Pembekal OpenClaw (LiteLLM, dll.)", "Penyedia OpenClaw (LiteLLM, dll.)", "ผู้ให้บริการ OpenClaw (LiteLLM ฯลฯ)"],
  ["HTTP tersuai / vendor (URL asas + protokol)", "HTTP kustom / vendor (URL dasar + protokol)", "HTTP แบบกำหนดเอง / ผู้ขาย (URL ราก + โปรโตคอล)"],
  [
    "LiteLLM hanya satu bentuk pembekal biasa; pilih HTTP Tersuai untuk gateway anda. Jika anda pilih pratetap ujian bar alat, URL/protokol pratetap itu didahulukan untuk ujian (anda masih pilih pembekal sasaran simpan di bawah).",
    "LiteLLM hanya satu bentuk penyedia umum; pilih HTTP Kustom untuk gateway Anda. Jika Anda memilih preset uji toolbar, URL/protokol preset itu diutamakan untuk uji (Anda tetap memilih penyedia target simpan di bawah).",
    "LiteLLM เป็นเพียงรูปแบบผู้ให้บริการทั่วไปหนึ่งแบบ เลือก HTTP แบบกำหนดเองสำหรับเกตเวย์ของคุณ หากเลือกพรีเซ็ตทดสอบในแถบเครื่องมือ URL/โปรโตคอลของพรีเซ็ตนั้นจะมีลำดับก่อนสำหรับการทดสอบ (คุณยังเลือกผู้ให้บริการปลายทางการบันทึกด้านล่าง)",
  ],
  ["Medan OpenClaw / gateway (termasuk LiteLLM)", "Bidang OpenClaw / gateway (termasuk LiteLLM)", "ฟิลด์ OpenClaw / gateway (รวม LiteLLM)"],
  [
    `• models.providers.<id>.baseUrl: punca gateway (openai-completions → /chat/completions; anthropic-messages → /v1/messages).
• api: biasanya "openai-completions" atau "anthropic-messages".
• apiKey: kunci untuk gateway; boleh digabung dengan auth.profiles.

Entri models[]: id (mesti sepadan dengan laluan huluan), name, contextWindow, maxTokens, input, reasoning.

Ujian menggabungkan agents/<Agent>/agent/models.json, main, dan openclaw.json; apiKey ALL_CAPS dibaca daripada env.`,
    `• models.providers.<id>.baseUrl: root gateway (openai-completions → /chat/completions; anthropic-messages → /v1/messages).
• api: sering "openai-completions" atau "anthropic-messages".
• apiKey: kunci untuk gateway; dapat digabung dengan auth.profiles.

Entri models[]: id (harus cocok dengan rute hulu), name, contextWindow, maxTokens, input, reasoning.

Probe menggabungkan agents/<Agent>/agent/models.json, main, dan openclaw.json; apiKey ALL_CAPS dibaca dari env.`,
    `• models.providers.<id>.baseUrl: รากเกตเวย์ (openai-completions → /chat/completions; anthropic-messages → /v1/messages)
• api: มักเป็น "openai-completions" หรือ "anthropic-messages"
• apiKey: คีย์สำหรับเกตเวย์ อาจใช้ร่วมกับ auth.profiles

รายการ models[]: id (ต้องตรงกับเส้นทางต้นทาง) name, contextWindow, maxTokens, input, reasoning

การทดสอบรวม agents/<Agent>/agent/models.json, main และ openclaw.json อ่าน apiKey แบบ ALL_CAPS จาก env`,
  ],
  ["Ujian HTTP tersuai / vendor", "Uji HTTP kustom / vendor", "การทดสอบ HTTP แบบกำหนดเอง / ผู้ขาย"],
  [
    "Tetapkan URL punca (tanpa akhiran laluan), protokol, dan kunci API sementara di bar alat. Hanya permintaan ini diuji terus; simpanan masih menulis ke blok pembekal yang dikembangkan.",
    "Atur URL root (tanpa sufiks path), protokol, dan kunci API sementara di toolbar. Hanya permintaan ini yang diuji langsung; penyimpanan tetap menulis ke blok penyedia yang diperluas.",
    "ตั้ง URL ราก (ไม่มี path ต่อท้าย) โปรโตคอล และคีย์ API ชั่วคราวในแถบเครื่องมือ มีเฉพาะคำขอนี้ที่ถูกทดสอบโดยตรง การบันทึกยังเขียนไปยังบล็อกผู้ให้บริการที่ขยายแล้ว",
  ],
  ["URL asas gateway", "URL dasar gateway", "URL รากของเกตเวย์"],
  ["Protokol (gaya laluan HTTP)", "Protokol (gaya path HTTP)", "โปรโตคอล (สไตล์ path HTTP)"],
  ["model (id model API)", "model (id model API)", "model (รหัสโมเดล API)"],
  ["cth. qwen3-max, gpt-4o", "mis. qwen3-max, gpt-4o", "เช่น qwen3-max, gpt-4o"],
  ["model_provider (label vendor, pilihan)", "model_provider (label vendor, opsional)", "model_provider (ป้ายผู้ขาย ไม่บังคับ)"],
  ["cth. JoyMaas, self-hosted", "mis. JoyMaas, self-hosted", "เช่น JoyMaas, self-hosted"],
  ["Konteks ujian (uji sahaja):", "Konteks uji (hanya uji):", "บริบทการทดสอบ (ทดสอบเท่านั้น):"],
  [
    "(sama seperti bar alat; hanya openclaw.json; memilih Ejen juga mengikat agents.list + defaults.models)",
    "(sama seperti toolbar; hanya openclaw.json; memilih Agen juga mengikat agents.list + defaults.models)",
    "(เหมือนแถบเครื่องมือ เฉพาะ openclaw.json การเลือกเอเจนต์ยังผูก agents.list + defaults.models)",
  ],
  ["Medan model LiteLLM / openclaw.json", "Bidang model LiteLLM / openclaw.json", "ฟิลด์โมเดล LiteLLM / openclaw.json"],
  [
    `• models.providers.<id>.baseUrl: URL asas LiteLLM anda (OpenClaw membina laluan serasi OpenAI).
• api: biasanya "openai-completions".
• apiKey: kunci ke LiteLLM; boleh dengan auth.profiles.

Setiap item dalam models[] biasanya: id (mesti sepadan nama laluan LiteLLM), name, contextWindow, maxTokens, input (cth. ["text","image"]), reasoning.

Ujian papan pemuka menggabungkan openclaw.json dengan agents/main/agent/models.json. Pemegang tempat apiKey ALL_CAPS (cth. LITELLM_API_KEY) diselesaikan daripada pembolehubah persekitaran. Jika hanya pemegang tempat digunakan sebelum ini, LiteLLM sering memulangkan "invalid key".`,
    `• models.providers.<id>.baseUrl: URL dasar LiteLLM Anda (OpenClaw membangun path kompatibel OpenAI).
• api: biasanya "openai-completions".
• apiKey: kunci ke LiteLLM; dapat dengan auth.profiles.

Setiap item di models[] biasanya: id (harus cocok nama rute LiteLLM), name, contextWindow, maxTokens, input (mis. ["text","image"]), reasoning.

Probe dashboard menggabungkan openclaw.json dengan agents/main/agent/models.json. Placeholder apiKey ALL_CAPS (mis. LITELLM_API_KEY) diselesaikan dari variabel lingkungan. Jika hanya placeholder yang dipakai sebelumnya, LiteLLM sering mengembalikan "invalid key".`,
    `• models.providers.<id>.baseUrl: URL ราก LiteLLM ของคุณ (OpenClaw สร้าง path ที่เข้ากันได้กับ OpenAI)
• api: มักเป็น "openai-completions"
• apiKey: คีย์ที่ส่งไป LiteLLM อาจใช้ร่วมกับ auth.profiles

แต่ละรายการใน models[] โดยทั่วไปมี: id (ต้องตรงชื่อเส้นทาง LiteLLM) name, contextWindow, maxTokens, input (เช่น ["text","image"]) reasoning

การทดสอบของแดชบอร์ดรวม openclaw.json กับ agents/main/agent/models.json ตัวยึด apiKey แบบ ALL_CAPS (เช่น LITELLM_API_KEY) แก้จากตัวแปรสภาพแวดล้อม หากใช้เฉพาะตัวยึดมาก่อน LiteLLM มักคืน "invalid key"`,
  ],
  ["Statistik mesej", "Statistik pesan", "สถิติข้อความ"],
  ["Analisis penggunaan token dan masa respons", "Analisis penggunaan token dan waktu respons", "การวิเคราะห์การใช้โทเค็นและเวลาตอบสนอง"],
  ["Jumlah Token Input", "Total Token Input", "โทเค็นขาเข้ารวม"],
  ["Jumlah Token Output", "Total Token Output", "โทเค็นขาออกรวม"],
  ["Jumlah mesej", "Total pesan", "จำนวนข้อความทั้งหมด"],
  ["Tempoh data", "Periode data", "ช่วงข้อมูล"],
  ["🔢 Penggunaan token", "🔢 Penggunaan token", "🔢 การใช้โทเค็น"],
  ["⏱️ Masa respons purata", "⏱️ Waktu respons rata-rata", "⏱️ เวลาตอบสนองเฉลี่ย"],
  ["📋 Sesi", "📋 Sesi", "📋 เซสชัน"],
  ["← Laman utama", "← Beranda", "← หน้าแรก"],
  ["Parameter ejen tiada", "Parameter agen hilang", "ไม่มีพารามิเตอร์เอเจนต์"],
  ["Tiada data masa respons", "Tidak ada data waktu respons", "ไม่มีข้อมูลเวลาตอบสนอง"],
  ["Pilih pakar untuk lihat statistik mesej", "Pilih ahli untuk melihat statistik pesan", "เลือกผู้เชี่ยวชาญเพื่อดูสถิติข้อความ"],
  ["← Kembali ke skuad pakar", "← Kembali ke skuad ahli", "← กลับไปทีมผู้เชี่ยวชาญ"],
  ["Sesi", "Sesi", "เซสชัน"],
  ["sesi", "sesi", "เซสชัน"],
  ["Jumlah Token", "Total Token", "โทเค็นรวม"],
  ["Parameter ejen tiada", "Parameter agen hilang", "ไม่มีพารามิเตอร์เอเจนต์"],
  ["Utama", "Utama", "หลัก"],
  ["DM Feishu", "DM Feishu", "DM Feishu"],
  ["Kumpulan Feishu", "Grup Feishu", "กลุ่ม Feishu"],
  ["DM Discord", "DM Discord", "DM Discord"],
  ["Saluran Discord", "Saluran Discord", "ช่อง Discord"],
  ["DM Telegram", "DM Telegram", "DM Telegram"],
  ["Kumpulan Telegram", "Grup Telegram", "กลุ่ม Telegram"],
  ["DM WhatsApp", "DM WhatsApp", "DM WhatsApp"],
  ["Kumpulan WhatsApp", "Grup WhatsApp", "กลุ่ม WhatsApp"],
  ["Kerja Cron", "Cron Job", "งาน Cron"],
  ["Tidak diketahui", "Tidak diketahui", "ไม่ทราบ"],
  ["Uji", "Uji", "ทดสอบ"],
  ["Menguji...", "Menguji...", "กำลังทดสอบ..."],
  ["✅ OK", "✅ OK", "✅ ตกลง"],
  ["❌ Gagal", "❌ Gagal", "❌ ล้มเหลว"],
  ["Balas", "Balas", "ตอบกลับ"],
  ["Masa", "Waktu", "เวลา"],
  ["Konteks", "Konteks", "บริบท"],
  ["Pilih pakar untuk lihat sesi", "Pilih ahli untuk melihat sesi", "เลือกผู้เชี่ยวชาญเพื่อดูเซสชัน"],
  ["🧪 Uji semua", "🧪 Uji semua", "🧪 ทดสอบทั้งหมด"],
  ["⏳ Menguji...", "⏳ Menguji...", "⏳ กำลังทดสอบ..."],
  [
    "Ujian mengesahkan respons ejen sahaja. Mesej tidak akan muncul dalam sembang Feishu/Discord.",
    "Uji hanya memverifikasi respons agen. Pesan tidak akan muncul di obrolan Feishu/Discord.",
    "การทดสอบตรวจเฉพาะการตอบสนองของเอเจนต์ ข้อความจะไม่ปรากฏในแชท Feishu/Discord",
  ],
  ["Ujian selesai", "Uji selesai", "ทดสอบเสร็จ"],
  ["lulus", "lulus", "ผ่าน"],
  ["gagal", "gagal", "ไม่ผ่าน"],
  ["← Kembali ke skuad pakar", "← Kembali ke skuad ahli", "← กลับไปทีมผู้เชี่ยวชาญ"],
  ["🧩 Pengurusan kemahiran", "🧩 Manajemen keterampilan", "🧩 การจัดการทักษะ"],
  ["kemahiran", "keterampilan", "ทักษะ"],
  ["Terbina dalam", "Bawaan", "ในตัว"],
  ["Sambungan", "Ekstensi", "ส่วนขยาย"],
  ["Tersuai", "Kustom", "กำหนดเอง"],
  ["Semua", "Semua", "ทั้งหมด"],
  ["Cari kemahiran...", "Cari keterampilan...", "ค้นหาทักษะ..."],
  ["Memaparkan", "Menampilkan", "กำลังแสดง"],
];
