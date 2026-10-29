export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      anamnesis: {
        Row: {
          actualizado_en: string
          consultorio_id: string
          creado_en: string
          estructura: Json
          fecha: string
          id: string
          paciente_id: string
          plantilla_id: string
          respuestas: Json
        }
        Insert: {
          actualizado_en?: string
          consultorio_id: string
          creado_en?: string
          estructura: Json
          fecha?: string
          id?: string
          paciente_id: string
          plantilla_id: string
          respuestas?: Json
        }
        Update: {
          actualizado_en?: string
          consultorio_id?: string
          creado_en?: string
          estructura?: Json
          fecha?: string
          id?: string
          paciente_id?: string
          plantilla_id?: string
          respuestas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnesis_consultorio_id_paciente_id_fkey"
            columns: ["consultorio_id", "paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["consultorio_id", "id"]
          },
          {
            foreignKeyName: "anamnesis_consultorio_id_plantilla_id_fkey"
            columns: ["consultorio_id", "plantilla_id"]
            isOneToOne: false
            referencedRelation: "plantillas_anamnesis"
            referencedColumns: ["consultorio_id", "id"]
          },
        ]
      }
      auditoria: {
        Row: {
          accion: string
          antes: Json | null
          consultorio_id: string
          despues: Json | null
          en: string
          id: number
          registro_id: string | null
          tabla: string
          user_id: string | null
        }
        Insert: {
          accion: string
          antes?: Json | null
          consultorio_id: string
          despues?: Json | null
          en?: string
          id?: never
          registro_id?: string | null
          tabla: string
          user_id?: string | null
        }
        Update: {
          accion?: string
          antes?: Json | null
          consultorio_id?: string
          despues?: Json | null
          en?: string
          id?: never
          registro_id?: string | null
          tabla?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bloqueos: {
        Row: {
          consultorio_id: string
          desde: string
          hasta: string
          id: string
          motivo: string | null
        }
        Insert: {
          consultorio_id: string
          desde: string
          hasta: string
          id?: string
          motivo?: string | null
        }
        Update: {
          consultorio_id?: string
          desde?: string
          hasta?: string
          id?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bloqueos_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          concepto: string
          consultorio_id: string
          creado_en: string
          fecha: string
          id: string
          monto_gs: number
          motivo: string | null
          paciente_id: string | null
          periodo: string
          snapshot: Json
          tipo: string
          turno_id: string | null
          tutor_id: string
        }
        Insert: {
          concepto: string
          consultorio_id: string
          creado_en?: string
          fecha: string
          id?: string
          monto_gs: number
          motivo?: string | null
          paciente_id?: string | null
          periodo: string
          snapshot?: Json
          tipo: string
          turno_id?: string | null
          tutor_id: string
        }
        Update: {
          concepto?: string
          consultorio_id?: string
          creado_en?: string
          fecha?: string
          id?: string
          monto_gs?: number
          motivo?: string | null
          paciente_id?: string | null
          periodo?: string
          snapshot?: Json
          tipo?: string
          turno_id?: string | null
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargos_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_consultorio_id_paciente_id_fkey"
            columns: ["consultorio_id", "paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["consultorio_id", "id"]
          },
          {
            foreignKeyName: "cargos_consultorio_id_turno_id_fkey"
            columns: ["consultorio_id", "turno_id"]
            isOneToOne: false
            referencedRelation: "turnos"
            referencedColumns: ["consultorio_id", "id"]
          },
          {
            foreignKeyName: "cargos_consultorio_id_tutor_id_fkey"
            columns: ["consultorio_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "saldos_tutores"
            referencedColumns: ["consultorio_id", "tutor_id"]
          },
          {
            foreignKeyName: "cargos_consultorio_id_tutor_id_fkey"
            columns: ["consultorio_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["consultorio_id", "id"]
          },
        ]
      }
      cierres: {
        Row: {
          cerrado_en: string | null
          consultorio_id: string
          estado: string
          id: string
          periodo: string
        }
        Insert: {
          cerrado_en?: string | null
          consultorio_id: string
          estado?: string
          id?: string
          periodo: string
        }
        Update: {
          cerrado_en?: string | null
          consultorio_id?: string
          estado?: string
          id?: string
          periodo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cierres_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
        ]
      }
      consultorios: {
        Row: {
          concepto_factura: string
          creado_en: string
          datos_pago: string | null
          dia_limite_pago: number
          direccion: string | null
          duracion_bloque_min: number
          dv: string | null
          horas_aviso_minimas: number
          id: string
          nombre: string
          profesional: string | null
          razon_social: string | null
          reglamento_texto: string | null
          reglamento_version: number
          ruc: string | null
          telefono_wa: string | null
          traslado_domicilio_min: number
          zona_horaria: string
        }
        Insert: {
          concepto_factura?: string
          creado_en?: string
          datos_pago?: string | null
          dia_limite_pago?: number
          direccion?: string | null
          duracion_bloque_min?: number
          dv?: string | null
          horas_aviso_minimas?: number
          id?: string
          nombre: string
          profesional?: string | null
          razon_social?: string | null
          reglamento_texto?: string | null
          reglamento_version?: number
          ruc?: string | null
          telefono_wa?: string | null
          traslado_domicilio_min?: number
          zona_horaria?: string
        }
        Update: {
          concepto_factura?: string
          creado_en?: string
          datos_pago?: string | null
          dia_limite_pago?: number
          direccion?: string | null
          duracion_bloque_min?: number
          dv?: string | null
          horas_aviso_minimas?: number
          id?: string
          nombre?: string
          profesional?: string | null
          razon_social?: string | null
          reglamento_texto?: string | null
          reglamento_version?: number
          ruc?: string | null
          telefono_wa?: string | null
          traslado_domicilio_min?: number
          zona_horaria?: string
        }
        Relationships: []
      }
      documentos: {
        Row: {
          consultorio_id: string
          creado_en: string
          fecha: string | null
          id: string
          mime: string
          paciente_id: string | null
          storage_path: string
          tamano_bytes: number
          tipo: string
          titulo: string
          tutor_id: string | null
        }
        Insert: {
          consultorio_id: string
          creado_en?: string
          fecha?: string | null
          id?: string
          mime: string
          paciente_id?: string | null
          storage_path: string
          tamano_bytes: number
          tipo: string
          titulo: string
          tutor_id?: string | null
        }
        Update: {
          consultorio_id?: string
          creado_en?: string
          fecha?: string | null
          id?: string
          mime?: string
          paciente_id?: string | null
          storage_path?: string
          tamano_bytes?: number
          tipo?: string
          titulo?: string
          tutor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_consultorio_id_paciente_id_fkey"
            columns: ["consultorio_id", "paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["consultorio_id", "id"]
          },
          {
            foreignKeyName: "documentos_consultorio_id_tutor_id_fkey"
            columns: ["consultorio_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "saldos_tutores"
            referencedColumns: ["consultorio_id", "tutor_id"]
          },
          {
            foreignKeyName: "documentos_consultorio_id_tutor_id_fkey"
            columns: ["consultorio_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["consultorio_id", "id"]
          },
        ]
      }
      facturas: {
        Row: {
          concepto: string
          consultorio_id: string
          creado_en: string
          emitida_en: string
          id: string
          mes_cobro: string
          monto_gs: number
          numero: string
          tutor_id: string
        }
        Insert: {
          concepto: string
          consultorio_id: string
          creado_en?: string
          emitida_en?: string
          id?: string
          mes_cobro: string
          monto_gs: number
          numero: string
          tutor_id: string
        }
        Update: {
          concepto?: string
          consultorio_id?: string
          creado_en?: string
          emitida_en?: string
          id?: string
          mes_cobro?: string
          monto_gs?: number
          numero?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facturas_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturas_consultorio_id_tutor_id_fkey"
            columns: ["consultorio_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "saldos_tutores"
            referencedColumns: ["consultorio_id", "tutor_id"]
          },
          {
            foreignKeyName: "facturas_consultorio_id_tutor_id_fkey"
            columns: ["consultorio_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["consultorio_id", "id"]
          },
        ]
      }
      horarios_atencion: {
        Row: {
          consultorio_id: string
          desde: string
          dia_semana: number
          hasta: string
          id: string
        }
        Insert: {
          consultorio_id: string
          desde: string
          dia_semana: number
          hasta: string
          id?: string
        }
        Update: {
          consultorio_id?: string
          desde?: string
          dia_semana?: number
          hasta?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_atencion_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
        ]
      }
      intentos_publicos: {
        Row: {
          clave: string
          en: string
          id: number
        }
        Insert: {
          clave: string
          en?: string
          id?: never
        }
        Update: {
          clave?: string
          en?: string
          id?: never
        }
        Relationships: []
      }
      mensajes_enviados: {
        Row: {
          canal: string
          clave: string
          consultorio_id: string
          enviado_en: string
          id: string
          referencia: string
          tutor_id: string | null
        }
        Insert: {
          canal: string
          clave: string
          consultorio_id: string
          enviado_en?: string
          id?: string
          referencia: string
          tutor_id?: string | null
        }
        Update: {
          canal?: string
          clave?: string
          consultorio_id?: string
          enviado_en?: string
          id?: string
          referencia?: string
          tutor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_enviados_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensajes_enviados_consultorio_id_tutor_id_fkey"
            columns: ["consultorio_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "saldos_tutores"
            referencedColumns: ["consultorio_id", "tutor_id"]
          },
          {
            foreignKeyName: "mensajes_enviados_consultorio_id_tutor_id_fkey"
            columns: ["consultorio_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["consultorio_id", "id"]
          },
        ]
      }
      miembros: {
        Row: {
          consultorio_id: string
          creado_en: string
          rol: string
          user_id: string
        }
        Insert: {
          consultorio_id: string
          creado_en?: string
          rol?: string
          user_id: string
        }
        Update: {
          consultorio_id?: string
          creado_en?: string
          rol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "miembros_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
        ]
      }
      notas: {
        Row: {
          actualizado_en: string
          consultorio_id: string
          creado_en: string
          fecha: string
          fijada: boolean
          id: string
          paciente_id: string
          texto: string
          turno_id: string | null
        }
        Insert: {
          actualizado_en?: string
          consultorio_id: string
          creado_en?: string
          fecha?: string
          fijada?: boolean
          id?: string
          paciente_id: string
          texto: string
          turno_id?: string | null
        }
        Update: {
          actualizado_en?: string
          consultorio_id?: string
          creado_en?: string
          fecha?: string
          fijada?: boolean
          id?: string
          paciente_id?: string
          texto?: string
          turno_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_consultorio_id_paciente_id_fkey"
            columns: ["consultorio_id", "paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["consultorio_id", "id"]
          },
          {
            foreignKeyName: "notas_consultorio_id_turno_id_fkey"
            columns: ["consultorio_id", "turno_id"]
            isOneToOne: false
            referencedRelation: "turnos"
            referencedColumns: ["consultorio_id", "id"]
          },
        ]
      }
      paciente_tutores: {
        Row: {
          consultorio_id: string
          paciente_id: string
          parentesco: string
          tutor_id: string
        }
        Insert: {
          consultorio_id: string
          paciente_id: string
          parentesco: string
          tutor_id: string
        }
        Update: {
          consultorio_id?: string
          paciente_id?: string
          parentesco?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paciente_tutores_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paciente_tutores_consultorio_id_paciente_id_fkey"
            columns: ["consultorio_id", "paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["consultorio_id", "id"]
          },
          {
            foreignKeyName: "paciente_tutores_consultorio_id_tutor_id_fkey"
            columns: ["consultorio_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "saldos_tutores"
            referencedColumns: ["consultorio_id", "tutor_id"]
          },
          {
            foreignKeyName: "paciente_tutores_consultorio_id_tutor_id_fkey"
            columns: ["consultorio_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["consultorio_id", "id"]
          },
        ]
      }
      pacientes: {
        Row: {
          apellido: string | null
          colegio: string | null
          consultorio_id: string
          creado_en: string
          derivado_por: string | null
          estado: string
          fecha_nacimiento: string | null
          id: string
          monto_override_gs: number | null
          motivo_consulta: string | null
          nombre: string
          plan_cobro: string
          responsable_pago_id: string | null
          tarifa_id: string | null
        }
        Insert: {
          apellido?: string | null
          colegio?: string | null
          consultorio_id: string
          creado_en?: string
          derivado_por?: string | null
          estado?: string
          fecha_nacimiento?: string | null
          id?: string
          monto_override_gs?: number | null
          motivo_consulta?: string | null
          nombre: string
          plan_cobro?: string
          responsable_pago_id?: string | null
          tarifa_id?: string | null
        }
        Update: {
          apellido?: string | null
          colegio?: string | null
          consultorio_id?: string
          creado_en?: string
          derivado_por?: string | null
          estado?: string
          fecha_nacimiento?: string | null
          id?: string
          monto_override_gs?: number | null
          motivo_consulta?: string | null
          nombre?: string
          plan_cobro?: string
          responsable_pago_id?: string | null
          tarifa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_consultorio_id_responsable_pago_id_fkey"
            columns: ["consultorio_id", "responsable_pago_id"]
            isOneToOne: false
            referencedRelation: "saldos_tutores"
            referencedColumns: ["consultorio_id", "tutor_id"]
          },
          {
            foreignKeyName: "pacientes_consultorio_id_responsable_pago_id_fkey"
            columns: ["consultorio_id", "responsable_pago_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["consultorio_id", "id"]
          },
          {
            foreignKeyName: "pacientes_consultorio_id_tarifa_id_fkey"
            columns: ["consultorio_id", "tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["consultorio_id", "id"]
          },
        ]
      }
      pagos: {
        Row: {
          consultorio_id: string
          creado_en: string
          factura_id: string | null
          fecha: string
          id: string
          medio: string
          monto_gs: number
          referencia: string | null
          tutor_id: string
        }
        Insert: {
          consultorio_id: string
          creado_en?: string
          factura_id?: string | null
          fecha?: string
          id?: string
          medio: string
          monto_gs: number
          referencia?: string | null
          tutor_id: string
        }
        Update: {
          consultorio_id?: string
          creado_en?: string
          factura_id?: string | null
          fecha?: string
          id?: string
          medio?: string
          monto_gs?: number
          referencia?: string | null
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_consultorio_id_factura_id_fkey"
            columns: ["consultorio_id", "factura_id"]
            isOneToOne: false
            referencedRelation: "facturas"
            referencedColumns: ["consultorio_id", "id"]
          },
          {
            foreignKeyName: "pagos_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_consultorio_id_tutor_id_fkey"
            columns: ["consultorio_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "saldos_tutores"
            referencedColumns: ["consultorio_id", "tutor_id"]
          },
          {
            foreignKeyName: "pagos_consultorio_id_tutor_id_fkey"
            columns: ["consultorio_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["consultorio_id", "id"]
          },
        ]
      }
      plantillas_anamnesis: {
        Row: {
          activa: boolean
          consultorio_id: string
          estructura: Json
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          consultorio_id: string
          estructura: Json
          id?: string
          nombre: string
        }
        Update: {
          activa?: boolean
          consultorio_id?: string
          estructura?: Json
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_anamnesis_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas_mensaje: {
        Row: {
          clave: string
          consultorio_id: string
          id: string
          texto: string
        }
        Insert: {
          clave: string
          consultorio_id: string
          id?: string
          texto: string
        }
        Update: {
          clave?: string
          consultorio_id?: string
          id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_mensaje_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
        ]
      }
      reglamento_firmas: {
        Row: {
          aceptado_en: string
          consultorio_id: string
          doc_firmante: string
          id: string
          ip_hash: string | null
          nombre_firmante: string
          texto_firmado: string
          tutor_id: string
          version: number
        }
        Insert: {
          aceptado_en?: string
          consultorio_id: string
          doc_firmante: string
          id?: string
          ip_hash?: string | null
          nombre_firmante: string
          texto_firmado: string
          tutor_id: string
          version: number
        }
        Update: {
          aceptado_en?: string
          consultorio_id?: string
          doc_firmante?: string
          id?: string
          ip_hash?: string | null
          nombre_firmante?: string
          texto_firmado?: string
          tutor_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reglamento_firmas_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reglamento_firmas_consultorio_id_tutor_id_fkey"
            columns: ["consultorio_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "saldos_tutores"
            referencedColumns: ["consultorio_id", "tutor_id"]
          },
          {
            foreignKeyName: "reglamento_firmas_consultorio_id_tutor_id_fkey"
            columns: ["consultorio_id", "tutor_id"]
            isOneToOne: false
            referencedRelation: "tutores"
            referencedColumns: ["consultorio_id", "id"]
          },
        ]
      }
      reglas_cobro: {
        Row: {
          consultorio_id: string
          estado: string
          id: string
          paciente_id: string | null
          porcentaje: number
        }
        Insert: {
          consultorio_id: string
          estado: string
          id?: string
          paciente_id?: string | null
          porcentaje: number
        }
        Update: {
          consultorio_id?: string
          estado?: string
          id?: string
          paciente_id?: string | null
          porcentaje?: number
        }
        Relationships: [
          {
            foreignKeyName: "reglas_cobro_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reglas_cobro_consultorio_id_paciente_id_fkey"
            columns: ["consultorio_id", "paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["consultorio_id", "id"]
          },
        ]
      }
      series_turnos: {
        Row: {
          consultorio_id: string
          creado_en: string
          desde: string
          dia_semana: number
          duracion_min: number
          estado: string
          hasta: string | null
          hora: string
          id: string
          paciente_id: string
          tipo_turno_id: string
        }
        Insert: {
          consultorio_id: string
          creado_en?: string
          desde: string
          dia_semana: number
          duracion_min?: number
          estado?: string
          hasta?: string | null
          hora: string
          id?: string
          paciente_id: string
          tipo_turno_id: string
        }
        Update: {
          consultorio_id?: string
          creado_en?: string
          desde?: string
          dia_semana?: number
          duracion_min?: number
          estado?: string
          hasta?: string | null
          hora?: string
          id?: string
          paciente_id?: string
          tipo_turno_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_turnos_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_turnos_consultorio_id_paciente_id_fkey"
            columns: ["consultorio_id", "paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["consultorio_id", "id"]
          },
          {
            foreignKeyName: "series_turnos_consultorio_id_tipo_turno_id_fkey"
            columns: ["consultorio_id", "tipo_turno_id"]
            isOneToOne: false
            referencedRelation: "tipos_turno"
            referencedColumns: ["consultorio_id", "id"]
          },
        ]
      }
      tarifas: {
        Row: {
          activa: boolean
          consultorio_id: string
          creado_en: string
          id: string
          monto_gs: number
          nombre: string
        }
        Insert: {
          activa?: boolean
          consultorio_id: string
          creado_en?: string
          id?: string
          monto_gs: number
          nombre: string
        }
        Update: {
          activa?: boolean
          consultorio_id?: string
          creado_en?: string
          id?: string
          monto_gs?: number
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_turno: {
        Row: {
          activo: boolean
          cobra_en_el_momento: boolean
          consultorio_id: string
          genera_cobro: boolean
          id: string
          modalidad: string
          nombre: string
          requiere_paciente: boolean
          tarifa_id: string | null
        }
        Insert: {
          activo?: boolean
          cobra_en_el_momento?: boolean
          consultorio_id: string
          genera_cobro?: boolean
          id?: string
          modalidad?: string
          nombre: string
          requiere_paciente?: boolean
          tarifa_id?: string | null
        }
        Update: {
          activo?: boolean
          cobra_en_el_momento?: boolean
          consultorio_id?: string
          genera_cobro?: boolean
          id?: string
          modalidad?: string
          nombre?: string
          requiere_paciente?: boolean
          tarifa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tipos_turno_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tipos_turno_consultorio_id_tarifa_id_fkey"
            columns: ["consultorio_id", "tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["consultorio_id", "id"]
          },
        ]
      }
      turnos: {
        Row: {
          aviso_en: string | null
          clase: string
          consultorio_id: string
          creado_en: string
          estado: string
          fin: string
          id: string
          inicio: string
          marcado_en: string | null
          motivo_excepcion: string | null
          motivo_ocupado: string | null
          nombre_reserva: string | null
          paciente_id: string | null
          porcentaje_manual: number | null
          repone_a: string | null
          reponer: boolean
          reprogramado_a: string | null
          serie_id: string | null
          tipo_turno_id: string | null
        }
        Insert: {
          aviso_en?: string | null
          clase?: string
          consultorio_id: string
          creado_en?: string
          estado?: string
          fin: string
          id?: string
          inicio: string
          marcado_en?: string | null
          motivo_excepcion?: string | null
          motivo_ocupado?: string | null
          nombre_reserva?: string | null
          paciente_id?: string | null
          porcentaje_manual?: number | null
          repone_a?: string | null
          reponer?: boolean
          reprogramado_a?: string | null
          serie_id?: string | null
          tipo_turno_id?: string | null
        }
        Update: {
          aviso_en?: string | null
          clase?: string
          consultorio_id?: string
          creado_en?: string
          estado?: string
          fin?: string
          id?: string
          inicio?: string
          marcado_en?: string | null
          motivo_excepcion?: string | null
          motivo_ocupado?: string | null
          nombre_reserva?: string | null
          paciente_id?: string | null
          porcentaje_manual?: number | null
          repone_a?: string | null
          reponer?: boolean
          reprogramado_a?: string | null
          serie_id?: string | null
          tipo_turno_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turnos_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_consultorio_id_paciente_id_fkey"
            columns: ["consultorio_id", "paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["consultorio_id", "id"]
          },
          {
            foreignKeyName: "turnos_consultorio_id_serie_id_fkey"
            columns: ["consultorio_id", "serie_id"]
            isOneToOne: false
            referencedRelation: "series_turnos"
            referencedColumns: ["consultorio_id", "id"]
          },
          {
            foreignKeyName: "turnos_consultorio_id_tipo_turno_id_fkey"
            columns: ["consultorio_id", "tipo_turno_id"]
            isOneToOne: false
            referencedRelation: "tipos_turno"
            referencedColumns: ["consultorio_id", "id"]
          },
          {
            foreignKeyName: "turnos_repone_a_fkey"
            columns: ["repone_a"]
            isOneToOne: false
            referencedRelation: "turnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_reprogramado_a_fkey"
            columns: ["reprogramado_a"]
            isOneToOne: false
            referencedRelation: "turnos"
            referencedColumns: ["id"]
          },
        ]
      }
      tutores: {
        Row: {
          activo: boolean
          apellido: string | null
          consultorio_id: string
          creado_en: string
          doc_numero: string | null
          doc_tipo: string | null
          dv: string | null
          email: string | null
          id: string
          nombre: string
          razon_social: string | null
          telefono_wa: string | null
          token_ficha: string
        }
        Insert: {
          activo?: boolean
          apellido?: string | null
          consultorio_id: string
          creado_en?: string
          doc_numero?: string | null
          doc_tipo?: string | null
          dv?: string | null
          email?: string | null
          id?: string
          nombre: string
          razon_social?: string | null
          telefono_wa?: string | null
          token_ficha?: string
        }
        Update: {
          activo?: boolean
          apellido?: string | null
          consultorio_id?: string
          creado_en?: string
          doc_numero?: string | null
          doc_tipo?: string | null
          dv?: string | null
          email?: string | null
          id?: string
          nombre?: string
          razon_social?: string | null
          telefono_wa?: string | null
          token_ficha?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutores_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      saldos_tutores: {
        Row: {
          consultorio_id: string | null
          nombre: string | null
          saldo_gs: number | null
          total_cargos_gs: number | null
          total_pagos_gs: number | null
          tutor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutores_consultorio_id_fkey"
            columns: ["consultorio_id"]
            isOneToOne: false
            referencedRelation: "consultorios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      crear_consultorio: { Args: { p_nombre: string }; Returns: string }
      mis_consultorios: { Args: never; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
