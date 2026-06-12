import { Dialog } from 'bits-ui'

import Overlay from './dialog-overlay.svelte'
import Content from './dialog-content.svelte'
import Header from './dialog-header.svelte'
import Title from './dialog-title.svelte'
import Description from './dialog-description.svelte'
import Footer from './dialog-footer.svelte'

// Root, Trigger and Close come straight from bits-ui — no wrapper needed
const Root = Dialog.Root
const Trigger = Dialog.Trigger
const Close = Dialog.Close

export {
	Root,
	Trigger,
	Close,
	Overlay,
	Content,
	Header,
	Title,
	Description,
	Footer,
	//
	Root as DialogRoot,
	Trigger as DialogTrigger,
	Close as DialogClose,
	Overlay as DialogOverlay,
	Content as DialogContent,
	Header as DialogHeader,
	Title as DialogTitle,
	Description as DialogDescription,
	Footer as DialogFooter
}
