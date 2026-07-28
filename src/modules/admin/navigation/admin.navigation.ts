import {
  IconDashboard,
  IconUsers,
  IconBuildingCommunity,
  IconChartBar,
  IconUsersGroup,
  IconArrowBackUp,
  IconSettings,
  IconHelp,
  IconClipboardText,
  IconBuildingSkyscraper,
  IconContract
} from "@tabler/icons-react"

export const adminNavigation = {
    user: {
        name: "shadcn",
        email: "m@example.com",
        avatar: "/avatars/shadcn.jpg",
    },
    navMain: [
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: IconDashboard,
        },
        {
            title: "Usuarios",
            url: "/usuarios",
            icon: IconUsers,
        },
        {
            title: "Publicaciones",
            url: "/publicaciones",
            icon: IconBuildingCommunity,
        },
        {
            title: "Analytics",
            url: "#",
            icon: IconChartBar,
        },
        {
            title: "Team",
            url: "#",
            icon: IconUsersGroup,
        },
        {
            title: "Volver a la app",
            url: "/",
            icon: IconArrowBackUp,
        },
    ],
    navSecondary: [
        {
            title: "Settings",
            url: "#",
            icon: IconSettings,
        },
        {
            title: "Get Help",
            url: "#",
            icon: IconHelp,
        },
    ],
    arrendamiento: [
        {
            name: "Solicitudes arrendamiento",
            url: "/admin/arrendamiento/solicitudes",
            icon: IconClipboardText,
        },
        {
            name: "Propiedades",
            url: "#",
            icon: IconBuildingSkyscraper,
        },
        {
            name: "Contratos",
            url: "#",
            icon: IconContract,
        },
    ],
}