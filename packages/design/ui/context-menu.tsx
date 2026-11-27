'use client';

import * as React from 'react';
import { PortalContainerContext } from '../lib/portal';
import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu';
import { cn } from '../lib/utils';

const ContextMenu = ContextMenuPrimitive.Root;
const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

function ContextMenuContent({ className, ...props }: ContextMenuPrimitive.Popup.Props) {
  const container = React.useContext(PortalContainerContext);
  return (
    <ContextMenuPrimitive.Portal container={container}>
      <ContextMenuPrimitive.Positioner className="isolate z-50">
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(
            'min-w-48 origin-(--transform-origin) rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

const item =
  "flex min-h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm text-popover-foreground no-underline outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

function ContextMenuItem({ className, ...props }: ContextMenuPrimitive.Item.Props) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      className={cn(item, className)}
      {...props}
    />
  );
}

function ContextMenuLinkItem({ className, ...props }: ContextMenuPrimitive.LinkItem.Props) {
  return (
    <ContextMenuPrimitive.LinkItem
      data-slot="context-menu-item"
      closeOnClick
      className={cn(item, className)}
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLinkItem,
};
