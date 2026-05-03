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
