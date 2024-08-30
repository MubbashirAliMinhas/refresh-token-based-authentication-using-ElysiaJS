import { prisma } from "@/db/config";
import { adminPermissions, userPermissions } from "@/utils/permission";

async function insertRolesAndPermissions() {
  const adminRole = await prisma.role.findFirst({
    where: { type: 'ADMIN' }
  })

  const userRole = await prisma.role.findFirst({
    where: { type: 'USER' }
  })

  if (!adminRole) {
    await prisma.role.create({
      data: {
        type: 'ADMIN',
        permissions: {
          createMany: {
            data: adminPermissions.map(x => ({ name: x }))
          }
        }
      }
    })
  } else {
    await prisma.role.update({
      where: { id: adminRole.id },
      data: {
        permissions: {
          deleteMany: {},
          createMany: {
            data: adminPermissions.map(x => ({ name: x }))
          }
        }
      }
    })
  }

  if (!userRole) {
    await prisma.role.create({
      data: {
        type: 'USER',
        permissions: {
          createMany: {
            data: userPermissions.map(x => ({ name: x }))
          }
        }
      }
    })
  } else {
    await prisma.role.update({
      where: { id: userRole.id },
      data: {
        permissions: {
          deleteMany: {},
          createMany: {
            data: userPermissions.map(x => ({ name: x }))
          }
        }
      }
    })
  }
}

insertRolesAndPermissions()