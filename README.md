# SGPT — Sistema de Gestión del Programa de Tutorías
**TecNM Campus Culiacán**

Sistema web para la gestión del Programa de Tutorías institucional, desarrollado como proyecto de Ingeniería de Software.

---

## Equipo

| Nombre | Rol |
|---|---|
| Luna Beltran Yahir | Desarrollo |
| Jauregui Uriarte Manuel | Desarrollo |
| Quiñonez Madrid Juan Carlos | Desarrollo |

**Maestra:** Quevedo Camacho Mirna Del Rosario  
**Materia:** Ingeniería de Software  
**Carrera:** Ing. en Sistemas Computacionales  

---

## Stack tecnológico

- **Frontend:** React + TypeScript (Vite)
- **Backend / BaaS:** Supabase (PostgreSQL, Auth, RLS)
- **Estilos:** TBD

---

## Funcionalidades principales (14 casos de uso)

El sistema cubre los siguientes módulos según el documento oficial del PT del TecNM:

- Gestión de usuarios por rol
- Registro de actividades del Programa de Tutorías
- Asignación de tutores a grupos y horarios
- Asignación de tutorados a tutores
- Captura de asistencias
- Evaluación de evidencias
- Evaluación parcial y final de tutorados
- Modificación de actividades del PT
- Carga de evidencias por tutorado
- Generación de acreditaciones
- Reportes operativos y estratégicos por carrera

---

## Roles del sistema

| Rol | Acceso |
|---|---|
| `coordinador_institucional` | Lectura y escritura total |
| `coordinador_departamental` | Gestión de asignaciones y tutorados |
| `jefe_departamento` | Lectura operativa + asignación de tutores |
| `tutor` | Sus grupos, sesiones y evaluaciones |
| `tutorado` | Sus propios datos y evidencias |
| `director` / `subdirector` | Solo lectura |

---

## Estructura del proyecto

```
src/
├── assets/
├── types/
│   └── database.types.ts   # Tipos generados desde Supabase
├── utils/
│   └── supabase.ts         # Cliente de Supabase
├── App.tsx
└── main.tsx
```

---

## Instalación local

**Requisitos:** Node.js 18+

```bash
# 1. Clonar el repositorio
git clone https://github.com/CarlosMadrid11/Programa-Tutorias.git
cd Programa-Tutorias

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# 4. Correr en desarrollo
npm run dev
```

---

## Variables de entorno

Crear un archivo `.env` en la raíz con:

```env
VITE_SUPABASE_URL=tu_url_aqui
VITE_SUPABASE_PUBLISHABLE_KEY=tu_key_aqui
```

Las credenciales se obtienen en el dashboard de Supabase → Settings → API.

---

## Base de datos

El backend está implementado 100% en Supabase con:

- **14 tablas** relacionadas (sistema, tutor, tutorado, sesion, evidencia, etc.)
- **Row Level Security (RLS)** por rol en todas las tablas
- **6 triggers** para validaciones automáticas de negocio
- **4 funciones** de negocio (asistencia, acreditación, riesgo)

Para regenerar los tipos de TypeScript desde la BD:

```bash
npx supabase gen types typescript --project-id TU_PROJECT_ID > src/types/database.types.ts
```