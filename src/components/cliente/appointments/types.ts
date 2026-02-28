export interface ClientAppointment {
  id: string
  start_at: string
  end_at: string
  status: string
  notes: string | null
  created_at: string
  professionals: { name: string } | null
  appointment_services: {
    id: string
    duration_minutes: number
    price: number
    services: { name: string } | null
  }[]
}

