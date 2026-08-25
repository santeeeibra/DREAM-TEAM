# Expansión Liga Profesional Argentina a 30 Equipos

## 📋 Resumen de Cambios

Se expandió la Liga Profesional Argentina de 20 a 30 equipos, organizados en 2 zonas de 15 equipos cada una (formato real argentino).

---

## ✅ Archivos Modificados

### 1. `src/data/leagues.js`
- **Total equipos:** 30 (antes: 20)
- **Estructura:** 2 zonas de 15 equipos
- **Correcciones aplicadas:**
  - ✅ Eliminado San Lorenzo duplicado (estaba en ambas zonas)
  - ✅ Removido Colón (descendido a Primera Nacional)
  - ✅ Removido Godoy Cruz (no está en la temporada actual)
  - ✅ Agregados: Gimnasia de Mendoza, Independiente Rivadavia, Aldosivi, Estudiantes de Río Cuarto

### 2. `src/data/escudoteca.js`
- Agregados escudos de los 10 clubes nuevos
- Mantenido sistema de fallback automático (badgeGenerator.js)

### 3. `src/engine/balance.js`
- **Ratings base** agregados para los 30 clubes (PRESION_INICIAL_TIER)
- **Estilos de juego** configurados (ESTILOS_CLUB)

---

## 🏆 Clasificación de Clubes

### **Los 5 Grandes Históricos** (ratings 30-38)
1. **River Plate** - rating: 38, presión: 38
2. **Boca Juniors** - rating: 36, presión: 36
3. **Racing Club** - rating: 34, presión: 34
4. **Independiente** - rating: 32, presión: 32
5. **San Lorenzo** - rating: 30, presión: 30

### **Medianos Exitosos** (ratings 26-28)
- Vélez Sarsfield: 28
- Estudiantes de La Plata: 26

### **Medianos** (ratings 16-22)
- Talleres: 22
- Huracán: 20
- Rosario Central: 20
- Belgrano: 20
- Gimnasia La Plata: 18
- Argentinos Juniors: 18
- Lanús: 18
- Newell's Old Boys: 18
- Banfield: 16
- Defensa y Justicia: 16

### **Chicos** (ratings 12-15)
- Instituto: 15
- Tigre: 15
- Platense: 14
- Unión: 14
- Atlético Tucumán: 14
- Sarmiento: 13
- Barracas Central: 13
- Central Córdoba: 13
- Deportivo Riestra: 12
- Gimnasia de Mendoza: 12
- Independiente Rivadavia: 12
- Aldosivi: 12
- Estudiantes de Río Cuarto: 12

---

## 📊 Distribución por Zonas

### **ZONA A** (15 equipos)
1. Boca Juniors ⭐
2. Independiente ⭐
3. San Lorenzo ⭐
4. Vélez Sarsfield
5. Estudiantes (LP)
6. Talleres
7. Lanús
8. Newell's Old Boys
9. Platense
10. Instituto
11. Unión
12. Defensa y Justicia
13. Central Córdoba
14. Deportivo Riestra
15. Gimnasia de Mendoza

### **ZONA B** (15 equipos)
1. River Plate ⭐
2. Racing Club ⭐
3. Huracán
4. Rosario Central
5. Argentinos Juniors
6. Belgrano
7. Gimnasia La Plata
8. Tigre
9. Banfield
10. Atlético Tucumán
11. Sarmiento
12. Barracas Central
13. Independiente Rivadavia
14. Aldosivi
15. Estudiantes de Río Cuarto

---

## ⚙️ Estilos de Juego Configurados

### Los 5 Grandes
- **Ofensivos y presionantes:** goles_mod +0.10 a +0.16, presion_extra 3-4
- River tiene el mayor modificador ofensivo (+0.16)

### Medianos Exitosos y Medianos
- **Balanceados:** goles_mod +0.02 a +0.08, presion_extra 1-2

### Chicos
- **Defensivos:** goles_mod negativos (-0.02 a -0.12), concedidos_mod altos
- Los recién ascendidos tienen los peores modificadores

---

## 🔍 Notas Importantes

1. **San Lorenzo:** Es UNO solo (parte de los 5 grandes históricos)
2. **Vélez y Estudiantes LP:** Reclasificados como "medianos exitosos" (no grandes)
3. **Colón:** Descendido, no incluido
4. **Godoy Cruz:** No está en la temporada actual
5. **Escudos:** Todos los clubes tienen URL configurada en escudoteca.js (fallback SVG automático si falla)

---

## ✅ Verificación

```bash
# Contar clubes en ligapro
node -p "const fs=require('fs'); const content=fs.readFileSync('src/data/leagues.js','utf8'); const match=content.match(/ligapro[\\s\\S]*?clubs: \\[([\\s\\S]*?)\\],/); const clubs=match[1].match(/\\{ id: '[^']+'/g); 'Total: ' + clubs.length"
# Output: Total: 30 ✅

# Verificar ratings en balance.js
grep -A 10 "Liga Profesional Argentina" src/engine/balance.js
```

---

## 📅 Fecha de Actualización
2026-08-25

## 👤 Cambios Aplicados Por
Kiro (AI Assistant)
