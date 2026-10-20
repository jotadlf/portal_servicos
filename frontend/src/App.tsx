import { Badge, Button, Container, Group, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { ArrowRight, ClipboardList, Clock3, LifeBuoy, Plus } from 'lucide-react'

const highlights = [
  {
    icon: Plus,
    title: 'Abra uma solicitação',
    description: 'Conte o que você precisa e acompanhe cada etapa.',
  },
  {
    icon: ClipboardList,
    title: 'Acompanhe seus pedidos',
    description: 'Consulte o andamento e o histórico dos seus serviços.',
  },
  {
    icon: LifeBuoy,
    title: 'Encontre ajuda',
    description: 'Acesse orientações para resolver suas dúvidas.',
  },
]

function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <Container size="lg" className="topbar-content">
          <Group gap="sm">
            <ThemeIcon size={40} radius="xl" color="indigo" variant="light">
              <LifeBuoy size={21} aria-hidden="true" />
            </ThemeIcon>
            <Text fw={700} size="lg" c="dark.8">
              Portal de serviços
            </Text>
          </Group>
          <Badge color="teal" variant="light" leftSection={<Clock3 size={13} />}>
            Atendimento digital
          </Badge>
        </Container>
      </header>

      <Container size="lg" className="page-content">
        <Paper className="welcome-card" radius="xl" p="xl">
          <Stack gap="lg" maw={620}>
            <Badge color="indigo" variant="light" w="fit-content">
              Um só lugar para cuidar do que você precisa
            </Badge>
            <Title order={1} className="welcome-title">
              Como podemos
              <br />
              ajudar você hoje?
            </Title>
            <Text c="dimmed" size="lg" maw={520}>
              Solicite serviços, acompanhe seus pedidos e tenha todas as informações sempre à mão.
            </Text>
            <Group>
              <Button size="md" radius="xl" rightSection={<ArrowRight size={17} />}>
                Acessar serviços
              </Button>
              <Button size="md" radius="xl" variant="subtle" color="gray">
                Ver minhas solicitações
              </Button>
            </Group>
          </Stack>
          <div className="welcome-illustration" aria-hidden="true">
            <div className="illustration-orbit illustration-orbit-outer" />
            <div className="illustration-orbit illustration-orbit-inner" />
            <ThemeIcon className="illustration-icon" size={104} radius={32} color="indigo">
              <ClipboardList size={52} strokeWidth={1.5} />
            </ThemeIcon>
            <span className="illustration-dot illustration-dot-one" />
            <span className="illustration-dot illustration-dot-two" />
          </div>
        </Paper>

        <Stack gap="md" mt={48}>
          <div>
            <Text c="indigo" fw={700} size="sm" tt="uppercase">
              Simples e prático
            </Text>
            <Title order={2} mt={6}>
              Resolva tudo pelo portal
            </Title>
          </div>
          <div className="highlight-grid">
            {highlights.map(({ icon: Icon, title, description }) => (
              <Paper key={title} className="highlight-card" radius="lg" p="lg" withBorder>
                <ThemeIcon size={44} radius="md" color="indigo" variant="light">
                  <Icon size={22} aria-hidden="true" />
                </ThemeIcon>
                <Text fw={700} mt="md">
                  {title}
                </Text>
                <Text c="dimmed" size="sm" mt={6} lh={1.6}>
                  {description}
                </Text>
              </Paper>
            ))}
          </div>
        </Stack>

        <Text c="dimmed" size="sm" ta="center" mt={56} mb="xl">
          Portal de serviços · Acesso fácil, onde você estiver.
        </Text>
      </Container>
    </main>
  )
}

export default App
