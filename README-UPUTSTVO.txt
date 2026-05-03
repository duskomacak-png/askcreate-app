START WORK PRO by AskCreate — MVP v1

KORACI:
1. U Supabase SQL Editor nalepi fajl: supabase-dopuna-v2.sql
2. Otvori script.js
3. Nađi liniju:
   const SUPABASE_KEY = "OVDE_NALEPI_TVOJ_SUPABASE_PUBLISHABLE_KEY";
4. Umesto placeholder-a nalepi Publishable key koji si sačuvao u supabase-podaci.txt
5. Ne ubacuj Secret key nikada.
6. Sačuvaj fajl.
7. Uploaduj sve fajlove na GitHub hosting.
8. Ne briši CNAME ako postoji. U njemu treba da piše askcreate.app

ULAZI:
- Super Admin: duskomacak@gmail.com + lozinka koju napraviš kroz app
- Direkcija: email + lozinka + šifra firme + pozivni kod
- Radnik: šifra firme + kod za ulaz

NAPOMENA:
Ovo je MVP. Nema slika, GPS, SMS, automatske naplate i komplikovanih modula.


STATUS:
Supabase Publishable key je već ubačen u script.js.


IZMENA v1.1:
Polje 'Ko je primio' je uklonjeno iz goriva. Primalac je automatski prijavljeni radnik koji šalje izveštaj.


IZMENA v1.2:
Radnik sada može dodati više mašina i više sipanja goriva. Svako sipanje goriva se povezuje sa izabranom mašinom/vozilom ili se upisuje ručno.


IZMENA v1.3:
Kvar sada ima jasne rubrike: ima kvar da/ne, zaustavlja rad da/ne, može nastaviti rad da/ne, hitnost i opis. Popravljena je boja dropdown opcija.


IZMENA v1.4:
U sekciji Kvar dodato je posebno dugme 'Pošalji kvar šefu mehanizacije odmah'. Ovo šalje hitnu prijavu kvara odmah, bez čekanja kraja smene i dnevnog izveštaja.


IZMENA v1.5:
Dugme za kvar je preimenovano u 'Evidentiraj kvar odmah'. Dodato je polje da li je šef mehanizacije pozvan telefonom. Kvar sada dobija status 'prijavljen', a u Direkcija inbox-u može da se menja u 'primljeno', 'u popravci' i 'rešeno' radi praćenja brzine popravke.


IZMENA v1.6:
Popravljena dugmad '+ Dodaj mašinu' i '+ Dodaj sipanje goriva'. Dodati su direktni onclick fallback pozivi i promenjen cache name u sw.js na startwork-pro-v16.


IZMENA v1.7:
Svaka dodata mašina sada otvara kompletan blok: mašina/vozilo, početni sati/MTČ, završni sati/MTČ, ukupno sati rada i opis rada. Svako sipanje goriva sada otvara kompletan blok: za koju mašinu, litara, MTČ/KM pri sipanju i ko je sipao.


IZMENA v1.8:
Direkcija panel je prebačen na Excel-friendly poslovni izgled: svetle kartice, zelena Excel boja, tabelarni inbox, jasniji statusi i bolji kontrast za prihvatanje kod firmi koje su navikle na Excel.


IZMENA v1.9:
Veliki Start Work PRO / AskCreate header ostaje samo na početnoj strani. Unutar aplikacije se prikazuje kompaktan radni header firme, jer plaćena firma treba da oseća da je to njen prostor. Brending je uklonjen iz radnog dela aplikacije.


IZMENA v1.9.1 SAFE:
Proverena i popravljena v1.9 verzija. AdminDashboard sada dobija kompaktan header. Public/login ekrani automatski vraćaju veliki početni brending. Odjava radnika sigurno vraća login/public režim. Uklonjena duplirana linija u admin status funkciji. Cache podignut na startwork-pro-v191.


IZMENA v1.9.2 FIX:
Popravljena kritična greška: internalLogoutBtn je greškom pozivao nepostojeću funkciju logout umesto signOut. Zbog toga se JS prekidao i početni ulazi nisu reagovali. Dodata zaštita za logoutBtn i cache podignut na startwork-pro-v192.


IZMENA v1.9.3:
Direkcija workspace je proširen skoro preko celog ekrana. Tamni unutrašnji header je sklonjen. Dugme Odjavi se prebačeno je u Direkcija zeleni header pored Osveži. Cache podignut na startwork-pro-v193.


IZMENA v1.9.4:
Direkcija panel više ne koristi viewport širinu nego širinu roditelja. Sada ide lepo preko raspoloživog prostora, centriran je i ne beži u desnu stranu. Cache podignut na startwork-pro-v194.


IZMENA v1.9.5 COMPLETE RESTORE:
Kompletna obnovljena verzija svih fajlova posle slučajnog brisanja. Proveren je JavaScript syntax, svi osnovni fajlovi su prisutni, i cache je podignut na startwork-pro-v195.


IZMENA v1.9.6:
Direkcija header dugmad su smanjena i poređana desno jedno ispod drugog: Odjavi se gore, Osveži dole. U izveštajima je uklonjen ružan JSON/kod iz Detalji prikaza i zamenjen čitljivim poslovnim prikazom: Osnovno, Mašine, Gorivo, Kvar, Materijal/Magacin.


IZMENA v1.9.7 CLEAN REPORTS:
Kompletna verzija za upload. Dugmad u Direkcija headeru su mala i desno jedno ispod drugog: Odjavi se gore, Osveži dole. Sirovi JSON/kod je potpuno uklonjen iz prikaza izveštaja. Direkcija vidi samo poslovni prikaz po sekcijama: Osnovno, Mašine/vozila, Gorivo, Kvar i Materijal/Magacin/Ture. Cache podignut na startwork-pro-v197.


IZMENA v1.9.8 RETURNED REPORTS:
Kada Direkcija vrati izveštaj na dopunu/ispravku, radnik kome pripada izveštaj vidi poseban panel 'Izveštaji vraćeni na dopunu'. Može otvoriti izveštaj, ispraviti podatke i poslati ga ponovo Direkciji. Ispravka ažurira isti report red i vraća status na sent, umesto da pravi nepotreban duplikat.


IZMENA v1.9.9 NO WORKER NOTE:
Iz radničke forme uklonjena je donja rubrika Napomena / Dodatna napomena jer su podaci već pokriveni kroz opis rada, mašine, gorivo i kvar. Novo slanje više ne šalje note polje iz radničke forme. Stari izveštaji koji već imaju note i dalje se mogu prikazati u Direkciji bez greške. Cache podignut na startwork-pro-v199.


IZMENA v1.10.0 DELETE AND MATERIALS:
Direkcija sada može da obriše osobu/radnika iz spiska i mašinu/vozilo iz spiska. Dodat je poseban tab Materijali: gore je + Dodaj materijal, ispod je spisak materijala sa dugmetom Obriši materijal. U SQL dopunu je dodata tabela public.materials i RLS policy za Direkciju. Cache podignut na startwork-pro-v1100.


IZMENA v1.10.1 CLEAR DELETE BUTTONS:
Dugmad za brisanje u Direkciji su sada mnogo jasnija i vidljiva na svakoj kartici posebno. Radnik/osoba se briše iz aktivnog spiska preko active=false da stari izveštaji ostanu sačuvani. Svaka mašina/vozilo ima posebno dugme 'Obriši ovu mašinu/vozilo'. Materijal takođe ima posebno dugme za brisanje. Cache podignut na startwork-pro-v1101.


IZMENA v1.10.2 SITE ARCHIVE:
Direkcija sada može da skloni završeno gradilište iz aktivnog spiska. Gradilište se ne briše fizički, nego se postavlja active=false kako bi stari izveštaji ostali sačuvani kao evidencija. Svako aktivno gradilište ima dugme 'Završi / skloni gradilište'. Cache podignut na startwork-pro-v1102.


IZMENA v1.10.3 ARCHIVE AND GLOBAL SEARCH:
Direkcija može arhivirati izveštaj i skloniti ga iz glavnog inbox-a, bez fizičkog brisanja iz baze. Dodata je globalna pretraga u Direkciji pored Excel export/tabs zone: može tražiti radnika/osobu, mašinu/vozilo, gradilište, materijal i izveštaje. Rezultati imaju akcije za upravljanje: sklanjanje radnika, brisanje mašine/vozila, sklanjanje gradilišta, brisanje materijala i arhiviranje izveštaja. SQL dopuna dodaje status archived u reports_status_check. Cache podignut na startwork-pro-v1103.


IZMENA v1.10.4 WORKER CODE LOGIN FIX:
Popravljen workflow prijave radnika. Direkcija kada dodaje radnika unosi šifru/kod za ulaz. Taj kod se normalizuje trim/lowercase i čuva u company_users.access_code. Radnik se prijavljuje samo tim kodom, bez email login-a. Login traži aktivnog radnika po access_code i active=true, učitava firmu i otvara radničku formu. Cache podignut na startwork-pro-v1104.


IZMENA v1.10.5 AUDIT FIX:
Proveren i popravljen kritičan deo koda. Radnički login vraćen je na Supabase RPC worker_login i koristi šifru firme + šifru/kod radnika. Kod se normalizuje lowercase/trim pri unosu radnika i pri login-u. Dodata SQL funkcija worker_login sa security definer i grant za anon/authenticated. Dugme Arhiviraj je dodato i u glavni inbox izveštaja, ne samo u pretragu. Cache podignut na startwork-pro-v1105.


IZMENA v1.10.6 WORKER LOGIN LOCK:
Dodat je jasan login princip: radnik se prijavljuje sa šifrom firme + svojim kodom. Direkcija vidi objašnjenje kod dodavanja radnika. App proverava da u istoj firmi ne postoji drugi aktivan radnik sa istim kodom. SQL dodaje jedinstveni indeks za company_id + lower(trim(access_code)) za aktivne radnike. worker_login SQL sada prvo dropuje staru funkciju da ne dođe do greške promene return type. Cache podignut na startwork-pro-v1106.


IZMENA v1.10.9 STABLE AUDIT FIX:
Vraćena stabilna HTML struktura iz v1.10.6 i urađen čist fix bez mešanja Super Admin / Radnik ekrana. Super Admin ostaje email+lozinka. Radnik login jasno ima Šifra firme + Šifra radnika. Direkcija pri dodavanju radnika unosi samo ime, prezime, funkciju i Šifra radnika, dok se šifra firme prikazuje automatski iz aktivne firme. Uklonjen dupli id companyCodeHelpBox. Cache podignut na startwork-pro-v1109.


IZMENA v1.11.2 NAV EDIT STABLE FIX:
Vraćena stabilna baza v1.10.9, dodat cache-busting za style.css i script.js, dodat fallback klik handler za data-goto dugmad da ulazi ne ostanu mrtvi ako neki kasniji bind pukne. Dodato uređivanje profila radnika u Direkciji: ✏️ Uredi profil, Sačuvaj izmene, Otkaži izmenu. Premešten panel vraćenih izveštaja u radničku formu. Cache podignut na startwork-pro-v1112.


IZMENA v1.11.3 DIRECTOR EDIT WORKER + ARCHIVE REPORT:
Direkcija sada ima dugme ✏️ Uredi profil kod svakog radnika. Forma levo se popunjava i može se izmeniti ime, prezime, funkcija, šifra radnika i rubrike koje vidi. Dodato je Otkaži izmenu. Kod svakog izveštaja u glavnom inbox-u dodato je dugme 🗑️ Skloni izveštaj, koje arhivira izveštaj statusom archived i sklanja ga iz glavnog inbox-a. Nije diran Supabase SQL. Cache podignut na startwork-pro-v1113.


IZMENA v1.11.4 EDIT WORKER + DELETE REPORT:
Stabilizovano uređivanje radnika u Direkciji. Dugme ✏️ Uredi profil otvara radnika u postojećoj formi, a Sačuvaj izmene ažurira isti company_users red. Dodato je pojedinačno trajno brisanje izveštaja iz baze preko dugmeta 🔥 Obriši iz baze. Ovo brisanje radi delete iz reports tabele. Hard-delete radnika nije dodat ako ima istoriju, da se ne pokvare veze i evidencija. Cache podignut na startwork-pro-v1114.


IZMENA v1.11.5 VISIBLE EDIT DELETE:
Provereno je da u v1.11.4 funkcija za uređivanje radnika postoji, ali dugme nije bilo ubačeno u listu radnika. U ovoj verziji je kompletna loadPeople funkcija prepisana tako da svaka kartica radnika sigurno prikazuje ✏️ Uredi profil i ❌ Obriši iz spiska. Kompletan reportHtml je prepisan tako da svaki izveštaj sigurno prikazuje 📦 Arhiviraj i 🔥 Obriši iz baze. Cache podignut na startwork-pro-v1115.

v1.11.6 — vidljiva dugmad za radnike bez oslanjanja na desni grid
Popravljen je prikaz radnika u Direkcija → Ljudi i funkcije. Kartica radnika sada koristi novi render person-card-v1116 i dugmad ✏️ Uredi profil / ❌ Obriši iz spiska stoje direktno ispod podataka radnika, tako da ih CSS/grid ne može gurnuti van vidljivog dela. Uređivanje radnika i dalje radi update postojećeg reda u company_users preko id + company_id. Brisanje radnika ostaje soft-delete: active=false. Nije potreban novi Supabase SQL. Cache i linkovi su podignuti na v1116.
