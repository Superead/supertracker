const { PrismaClient } = require("@prisma/client");
const { hashSync } = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  console.log("🎓 Eğitim verileri aktarılıyor...");

  // Kullanıcı hesaplarını oluştur (yoksa)
  const educatorUsers = [
    // Dahili eğitmenler
    { email: "elif@superead.com", name: "Elif", password: hashSync("egitim123", 10), role: "agent" },
    { email: "buse@superead.com", name: "Buse", password: hashSync("egitim123", 10), role: "agent" },
    // Harici eğitmenler
    { email: "sevcan@egitmen.superead.com", name: "Sevcan Hoca", password: hashSync("ders123", 10), role: "agent" },
    { email: "filiz@egitmen.superead.com", name: "Filiz Can Ulu", password: hashSync("ders123", 10), role: "agent" },
    { email: "hanife@egitmen.superead.com", name: "Hanife Güden", password: hashSync("ders123", 10), role: "agent" },
    { email: "ravza@egitmen.superead.com", name: "Ravza Hande", password: hashSync("ders123", 10), role: "agent" },
    { email: "emel@egitmen.superead.com", name: "Emel Çelik", password: hashSync("ders123", 10), role: "agent" },
    { email: "nurettin@egitmen.superead.com", name: "Nurettin Yatkın", password: hashSync("ders123", 10), role: "agent" },
    { email: "dilsah@egitmen.superead.com", name: "Dilşah İkizek", password: hashSync("ders123", 10), role: "agent" },
    { email: "sevde@egitmen.superead.com", name: "Sevde Nur Demirciler", password: hashSync("ders123", 10), role: "agent" },
  ];

  for (const u of educatorUsers) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      await prisma.user.create({ data: u });
      console.log(`  + Kullanıcı oluşturuldu: ${u.email}`);
    } else {
      console.log(`  ✓ Kullanıcı mevcut: ${u.email}`);
    }
  }

  // Eğitmenleri oluştur (yoksa)
  const educatorData = [
    { name: "Sevcan Hoca", phone: null, iban: null },
    { name: "Filiz Can Ulu", phone: "5377894802", iban: "TR720006701000000080118086" },
    { name: "Mehmet Taşhanlıgil", phone: null, iban: null },
    { name: "Hanife Güden", phone: "5447244072", iban: null },
    { name: "Ravza Hande", phone: null, iban: null },
    { name: "Elif Talay", phone: null, iban: null },
    { name: "Buse Kaynak Yıldız", phone: null, iban: null },
    { name: "Emel Çelik", phone: "5538444763", iban: null },
    { name: "Nurettin Yatkın", phone: "05055035655", iban: null },
    { name: "Dilşah İkizek", phone: "05322273299", iban: null },
    { name: "Sevde Nur Demirciler", phone: "5444634607", iban: null },
  ];

  // User ID'lerini bul
  const userEmails = {
    "Elif Talay": "elif@superead.com",
    "Buse Kaynak Yıldız": "buse@superead.com",
    "Sevcan Hoca": "sevcan@egitmen.superead.com",
    "Filiz Can Ulu": "filiz@egitmen.superead.com",
    "Hanife Güden": "hanife@egitmen.superead.com",
    "Ravza Hande": "ravza@egitmen.superead.com",
    "Emel Çelik": "emel@egitmen.superead.com",
    "Nurettin Yatkın": "nurettin@egitmen.superead.com",
    "Dilşah İkizek": "dilsah@egitmen.superead.com",
    "Sevde Nur Demirciler": "sevde@egitmen.superead.com",
  };

  const educatorUserMap = {};
  for (const [name, email] of Object.entries(userEmails)) {
    const user = await prisma.user.findUnique({ where: { email } });
    educatorUserMap[name] = user?.id || null;
  }

  // Dahili eğitmenler (tüm öğrencileri görebilir)
  const internalEducators = new Set(["Elif Talay", "Buse Kaynak Yıldız"]);

  const educators = {};
  for (const ed of educatorData) {
    const existing = await prisma.educator.findFirst({ where: { name: ed.name } });
    const shouldLink = educatorUserMap[ed.name] || null;
    const isInternal = internalEducators.has(ed.name);

    if (existing) {
      educators[ed.name] = existing.id;
      const updates = {};
      if (shouldLink && !existing.userId) updates.userId = shouldLink;
      if (isInternal && !existing.isInternal) updates.isInternal = true;
      if (Object.keys(updates).length > 0) {
        await prisma.educator.update({ where: { id: existing.id }, data: updates });
        console.log(`  🔗 Güncellendi: ${ed.name}`);
      }
      console.log(`  ✓ Mevcut eğitmen: ${ed.name}`);
    } else {
      const data = { ...ed, userId: shouldLink, isInternal };
      const created = await prisma.educator.create({ data });
      educators[ed.name] = created.id;
      console.log(`  + Yeni eğitmen: ${ed.name}${shouldLink ? " (bağlı)" : ""}`);
    }
  }

  // Öğrencileri oluştur
  const students = [
    // 1-3: Sevcan Hoca / Mehmet Taşhanlıgil (tamamlandı)
    { studentName: "Sarp Işık", parentName: "Zişan Işık", parentPhone: "532546807", email: "zisaneczanesi@gmail.com", grade: "7.sınıf", totalLessons: 12, completedLessons: 12, schedule: "Tamamlandı", notes: "OK", status: "completed", followUp21: "Başladı-Devam Ediyor", educator: "Sevcan Hoca" },
    { studentName: "İkra Su Serin", parentName: "Fatma Serin", parentPhone: "5337673912", email: "feyzioglu1299@gmail.com", grade: "1.sınıf", totalLessons: 12, completedLessons: 12, schedule: "Tamamlandı", notes: null, status: "completed", followUp21: "Başladı-Devam Ediyor", educator: "Sevcan Hoca" },
    { studentName: "Hanah Nekoonam", parentName: "Panah Nekoonam", parentPhone: "5438998133", email: "panahahmadaie@gmail.com", grade: "İranlı, 2.sınıf", totalLessons: 12, completedLessons: 12, schedule: "Tamamlandı", notes: "OK", status: "completed", followUp21: "Başladı-Devam Ediyor", educator: "Sevcan Hoca" },

    // 4: Filiz Can Ulu
    { studentName: "Miran Çetin", parentName: "Nazlı Çetin", parentPhone: "5433620136", email: "nazdpu@hotmail.com", grade: "4.sınıf", totalLessons: 10, completedLessons: 10, schedule: "30 Mayıs itibari ile ders planlanmıştır. Cmt ve Pazar 12:00-13:00", notes: null, status: "completed", followUp21: "Başladı-Devam Ediyor", paymentAmount: "5.000TL", educator: "Filiz Can Ulu" },

    // 5-6: Mehmet Taşhanlıgil
    { studentName: "Hazal", parentName: "Çiğdem Poyrazoğlu", parentPhone: "5325119135", email: "cigdem.poyraz@hotmail.com", grade: "ortaokul", totalLessons: 12, completedLessons: 6, schedule: null, notes: null, status: "in_progress", educator: "Mehmet Taşhanlıgil" },
    { studentName: "İklim Deva Can", parentName: "Tuğba Öztürk", parentPhone: "5445389013", email: "tgb__oztrk@hotmail.com", grade: "5.sınıf", totalLessons: 12, completedLessons: 0, schedule: "13 Haziran itibari ile başlanacak", notes: null, status: "planned", educator: "Mehmet Taşhanlıgil" },

    // 7: Hanife Güden
    { studentName: "Deniz Eymen Sarıoğlu", parentName: "Hacer Hanım", parentPhone: "5448358357", email: "Hacerkandemir07@hotmail.com", grade: "7.sınıf", totalLessons: 10, completedLessons: 0, schedule: "13 Haziran Cumartesi saat 20.00 itibariyle ders planlanmıştır", notes: null, status: "in_progress", educator: "Hanife Güden" },

    // 8-9: Ravza Hande
    { studentName: "Elanur Aktaş", parentName: "Nilgün Aktaş", parentPhone: null, email: "akrep50500@gmail.com", grade: "3.sınıf", totalLessons: 10, completedLessons: 0, schedule: "Salı: 13.00-14.30, Çarşamba: 11.00-12.30, Perşembe: 13.00-14.30", notes: "30.06.2026 Salı günü derse başlıyoruz", status: "in_progress", educator: "Ravza Hande" },
    { studentName: "Elis Ada Aktaş", parentName: "Nilgün Aktaş", parentPhone: null, email: "akrep50500@gmail.com", grade: "4.sınıf", totalLessons: 10, completedLessons: 0, schedule: "Salı: 14.45-16.15, Çarşamba: 12.45-14.15, Perşembe: 14.45-16.15", notes: null, status: "in_progress", educator: "Ravza Hande" },

    // 10-14: Elif Talay
    { studentName: "Taha Eymen Yetim", parentName: null, parentPhone: "5069478223", email: "everest-09@hotmail.com", grade: "8.sınıf", totalLessons: 10, completedLessons: 0, schedule: "25 Haziran 17-18 arası ders planlanmıştır", notes: null, status: "in_progress", educator: "Elif Talay" },
    { studentName: "Zehra Maden", parentName: "Arzu Hanım", parentPhone: "5057409076", email: "arzuozturk055@hotmail.com", grade: "8.sınıf", totalLessons: 12, completedLessons: 0, schedule: "20 Temmuz itibari ile ders planlanmıştır", notes: null, status: "planned", educator: "Elif Talay" },
    { studentName: "İpek Civelek", parentName: null, parentPhone: "5354211984", email: "Hakan-civelek@hotmail.com", grade: "8.sınıf", totalLessons: 10, completedLessons: 0, schedule: "1 Temmuz itibari ile ders planlanmıştır", notes: null, status: "planned", educator: "Elif Talay" },
    { studentName: "Batın Ege Doğan", parentName: null, parentPhone: "5435153449", email: "efzb2013@gmail.com", grade: "7.sınıf", totalLessons: 12, completedLessons: 0, schedule: null, notes: null, status: "planned", educator: "Elif Talay" },
    { studentName: "Zehra Nur Kaya", parentName: "Adem Bey", parentPhone: null, email: "Zehranurkaya4444@gmail.com", grade: "5.sınıf", totalLessons: 12, completedLessons: 0, schedule: "6.sınıf", notes: null, status: "planned", educator: "Elif Talay" },

    // 15-18: Buse Kaynak Yıldız
    { studentName: "Arya Karaarslan", parentName: "Gül Varlı Karaarslan", parentPhone: "5053736364", email: "gulvarli@gmail.com", grade: "2.sınıf", totalLessons: 10, completedLessons: 0, schedule: "Geri dönüş bekleniyor", notes: null, status: "planned", educator: "Buse Kaynak Yıldız" },
    { studentName: "Betül Berra Yetim", parentName: null, parentPhone: "5069478223", email: "everest-09+2@hotmail.com", grade: "8.sınıf", totalLessons: 10, completedLessons: 0, schedule: "22 Haziran 17-18 arası ders planlanmıştır", notes: null, status: "in_progress", educator: "Buse Kaynak Yıldız" },
    { studentName: "Ömer Şirvan", parentName: "Dilek Güzel", parentPhone: "532697764", email: "dilek.sirvan@gmail.com", grade: "6.sınıf", totalLessons: 10, completedLessons: 0, schedule: "Pazartesi Salı Çarşamba haftada 3 gün, 22 Haziranda başlıyor", notes: null, status: "in_progress", educator: "Buse Kaynak Yıldız" },
    { studentName: "Zeki Eymen Doğan", parentName: null, parentPhone: "5435153449", email: "efzb2013@gmail.com", grade: "7.sınıf", totalLessons: 12, completedLessons: 0, schedule: null, notes: null, status: "planned", educator: "Buse Kaynak Yıldız" },

    // 19: Mehmet Taşhanlıgil
    { studentName: "Taha Kayra Güllüoğlu", parentName: "Serdar Bey", parentPhone: null, email: "tahakayragulluoglu@gmail.com", grade: "12.sınıf", totalLessons: 12, completedLessons: 0, schedule: null, notes: null, status: "pending", educator: "Mehmet Taşhanlıgil" },

    // 20-22: Atanmamış
    { studentName: "Belis Yıldırım", parentName: "Yusuf Yıldırım", parentPhone: "5052425480", email: "Belissyildirim@gmail.com", grade: "6.sınıf", totalLessons: 10, completedLessons: 0, schedule: "Hafta içi gün fark etmez 13:00 ders saati başlangıcı", notes: null, status: "pending", educator: null },
    { studentName: "Gökçe Topcu", parentName: null, parentPhone: "5071846684", email: "berattopcu@gmail.com", grade: null, totalLessons: 10, completedLessons: 0, schedule: "Temmuz 16 sonrası istiyor", notes: null, status: "pending", educator: null },
    { studentName: "Gökçe Topcu (2)", parentName: null, parentPhone: "5071846685", email: "gorurozlem@gmail.com", grade: null, totalLessons: 10, completedLessons: 0, schedule: "Temmuz 16 sonrası istiyor", notes: null, status: "pending", educator: null },

    // 23: Filiz Can Ulu
    { studentName: "Zeynep Alya Düz", parentName: "Erkan Bey", parentPhone: "5061705480", email: "erkanduz35@gmail.com", grade: null, totalLessons: 10, completedLessons: 0, schedule: "15 Temmuz haftası yoklar, hafta içi 11:00-12:00 ders saati", notes: null, status: "in_progress", educator: "Filiz Can Ulu" },

    // 24: Emel Çelik
    { studentName: "Nefes Özsümer", parentName: "Çağrı Özsümer", parentPhone: "5425422526", email: "cgrozsumer@gmail.com", grade: "3.sınıf", totalLessons: 10, completedLessons: 0, schedule: "Pazartesi Çarşamba Cuma 17:00 ders saati, 22 Haziran haftası", notes: null, status: "in_progress", educator: "Emel Çelik" },

    // 25: Nurettin Yatkın
    { studentName: "Kerem Karabulut", parentName: "Nurbanu Hanım", parentPhone: null, email: "nurbanukarabulut.58@gmail.com", grade: "4.sınıf", totalLessons: 12, completedLessons: 0, schedule: "Akşam 6'dan sonra, hafta içi her gün müsait, 29 Haziran haftası başlamak isterler", notes: "Sesli okumada hatalar var, dk 56 kelime 7 yanlış", status: "in_progress", educator: "Nurettin Yatkın" },

    // 26: Emel Çelik
    { studentName: "Mustafa Asaf Öztürk", parentName: "Ömer Faruk Öztürk", parentPhone: "5330548822", email: "o.farukozturkk@gmail.com", grade: "9 yaş", totalLessons: 12, completedLessons: 0, schedule: "Hafta içi her gün 13:00-14:00 arası, hafta sonu 19:00", notes: null, status: "in_progress", educator: "Emel Çelik" },

    // 27: Dilşah İkizek
    { studentName: "Bartu Kıral", parentName: "Gülsen Kıral", parentPhone: "5345240939", email: "gulsenbarutkiral@gmail.com", grade: null, totalLessons: 12, completedLessons: 0, schedule: "Sabah saatleri, haftada 2 ya da 3 ders saati", notes: null, status: "in_progress", educator: "Dilşah İkizek" },

    // 28: Nurettin Yatkın
    { studentName: "Çınar Karabulut", parentName: "Nurbanu Hanım", parentPhone: null, email: "nurbanukarabulut.58@gmail.com", grade: "6.sınıf", totalLessons: 12, completedLessons: 0, schedule: "Akşam 6'dan sonra, hafta içi her gün müsait, 29 Haziran haftası başlamak isterler", notes: "Dakikada 113, 5 yanlış 3 doğru", status: "in_progress", educator: "Nurettin Yatkın" },

    // 29: Sevde Nur Demirciler
    { studentName: "Yağmur Günaydın", parentName: "Yücel Günaydın", parentPhone: null, email: "y.c.l.79@hotmail.com", grade: "4.sınıf", totalLessons: 10, completedLessons: 0, schedule: "Akşam 8-9 ister, 5 Temmuz sonrası ister", notes: null, status: "in_progress", educator: "Sevde Nur Demirciler" },

    // 30-38: Atanmamış
    { studentName: "Zeynep Derin Ulaşan", parentName: "Gözde Hanım", parentPhone: null, email: "z.derin1310@gmail.com", grade: "8.sınıf", totalLessons: 12, completedLessons: 0, schedule: "30 Haziran itibariyle Salı Cuma saat 14 olarak planlama", notes: null, status: "pending", educator: null },
    { studentName: "Yalçın Sefa Özen", parentName: "Merve Hanım", parentPhone: null, email: "mesozen2006@gmail.com", grade: "6.sınıf", totalLessons: 10, completedLessons: 0, schedule: "Ağustos gibi düşünüyor", notes: null, status: "pending", educator: null },
    { studentName: "Reyyan Sena Özen", parentName: "Merve Hanım", parentPhone: null, email: "mesozen2006@gmail.com", grade: "1.sınıf", totalLessons: 10, completedLessons: 0, schedule: "Ağustos gibi düşünüyor", notes: null, status: "pending", educator: null },
    { studentName: "Abdullah Yusuf Ekşioğlu", parentName: "Ayten Ekşioğlu", parentPhone: null, email: "av.ayteneksioglu@gmail.com", grade: "8.sınıf", totalLessons: 12, completedLessons: 0, schedule: "Geri dönüş bekleniyor", notes: null, status: "pending", educator: null },
    { studentName: "Nehir Karsan", parentName: null, parentPhone: "5418160969", email: "nehir.karsan@gmail.com", grade: null, totalLessons: 10, completedLessons: 0, schedule: "Çarşamba Cuma 2 ya da 3", notes: "10 saat yüzyüze eğitim", status: "pending", educator: null },
    { studentName: "Ömer Asaf Kaplan", parentName: null, parentPhone: "5432746980", email: "arzualagz@gmail.com", grade: "8.sınıf", totalLessons: 12, completedLessons: 0, schedule: "Temmuz 10 öncesi program bitsin ister, hafta içi 10:30 ders saati", notes: null, status: "pending", educator: null },
    { studentName: "Bekir Uysal", parentName: "Nurgül Hanım", parentPhone: "5458082656", email: "nurgul2_2@hotmail.com", grade: "5.sınıf", totalLessons: 12, completedLessons: 0, schedule: "Gün fark etmez akşam 18:30 sonrası, hafta sonu da ister", notes: null, status: "pending", educator: null },
    { studentName: "Mila Ertan", parentName: "Sema Hanım", parentPhone: null, email: "Sema.ertan@prosim.com.tr", grade: "6.sınıf", totalLessons: 12, completedLessons: 0, schedule: null, notes: null, status: "pending", educator: null },
  ];

  let created = 0;
  let skipped = 0;

  for (const s of students) {
    // Skip LGS Grubu (row 35 - not a real student)
    const existing = await prisma.student.findFirst({
      where: { studentName: s.studentName, isActive: true },
    });

    if (existing) {
      console.log(`  ⏭ Mevcut: ${s.studentName}`);
      skipped++;
      continue;
    }

    const educatorId = s.educator ? educators[s.educator] || null : null;

    await prisma.student.create({
      data: {
        studentName: s.studentName,
        parentName: s.parentName,
        parentPhone: s.parentPhone,
        email: s.email,
        grade: s.grade,
        totalLessons: s.totalLessons,
        completedLessons: s.completedLessons,
        schedule: s.schedule,
        notes: s.notes,
        status: s.status,
        followUp21: s.followUp21 || null,
        paymentAmount: s.paymentAmount || null,
        educatorId,
      },
    });
    console.log(`  ✅ Eklendi: ${s.studentName} → ${s.educator || "Atanmamış"}`);
    created++;
  }

  console.log(`\n📊 Sonuç: ${created} öğrenci eklendi, ${skipped} zaten mevcuttu`);

  const normName = (s) => (s || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();

  // Ensure every @egitmen.superead.com user has a linked educator record
  const unlinkedEgitmenUsers = await prisma.user.findMany({
    where: { email: { endsWith: "@egitmen.superead.com" }, educator: null },
  });
  for (const u of unlinkedEgitmenUsers) {
    const orphans = await prisma.educator.findMany({ where: { userId: null, isActive: true } });
    const orphanEducator = orphans.find((o) => normName(o.name) === normName(u.name));
    if (orphanEducator) {
      await prisma.educator.update({ where: { id: orphanEducator.id }, data: { userId: u.id } });
      console.log(`🔗 Mevcut eğitmen kaydına bağlandı: ${u.name}`);
    } else {
      await prisma.educator.create({ data: { name: u.name, userId: u.id, isActive: true } });
      console.log(`🔗 Eğitmen kaydı oluşturuldu: ${u.name}`);
    }
  }

  // Fix roles: users linked to an educator record should have role "educator" (not "agent")
  const roleFixed = await prisma.user.updateMany({
    where: {
      role: "agent",
      educator: { isNot: null },
    },
    data: { role: "educator" },
  });
  if (roleFixed.count > 0) {
    console.log(`🔧 ${roleFixed.count} eğitmen kullanıcısının rolü "educator" olarak düzeltildi`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
