/**
 * Tactile navigation plugin carousel class
 */
class CarouselTouchPlugin {
	/**
	 * @param {carousel} carousel - Instance of Carousel class
	 */
	constructor(carousel){
		carousel.container.addEventListener('dragstart', e => e.preventDefault()) // Prevent default drag behavior
		this.carousel = carousel

		// Register drag start events
		carousel.container.addEventListener('mousedown', this.startDrag.bind(this))
		carousel.container.addEventListener('touchstart', this.startDrag.bind(this))

		// Register dragging motion
		window.addEventListener('mousemove', this.drag.bind(this))
		window.addEventListener('touchmove', this.drag.bind(this))

		// Register drag end / cancel
		window.addEventListener('mouseup', this.endDrag.bind(this))
		window.addEventListener('touchend', this.endDrag.bind(this))
		window.addEventListener('touchcancel', this.endDrag.bind(this))
	}

	/**
	 * Start the navigation by touch/mouse
	 * @param {MouseEvent | TouchEvent} e - Interaction event
	 */
	startDrag(e){
		if(e.touches){
			if(e.touches.length > 1 ){
				return // Ignore multi-touch
			}else{
				e = e.touches[0]
			}
		}
		this.origin = { x : e.screenX , y : e.screenY }
		this.width = this.carousel.containerWidth
		this.carousel.disableTransition()
	}

	/**
	 * Handle drag movement
	 * @param {MouseEvent | TouchEvent} e
	 */
	drag(e){
		if(this.origin){
			let point = e.touches ? e.touches[0] : e
			let translate = { x : point.screenX - this.origin.x, y : point.screenY - this.origin.y }

			// Prevent vertical scrolling during horizontal drag
			if(e.touches && Math.abs(translate.x) > Math.abs(translate.y)){
				e.preventDefault()
				e.stopPropagation()
			}else if(e.touches){
				return
			}

			let baseTranslate = this.carousel.currentItem * -100 / this.carousel.items.length
			this.lastTranslate = translate
			this.carousel.translate(baseTranslate + 100 * translate.x / this.width)
		}
	}

	/**
	 * End the touch/mouse drag
	 * @param {MouseEvent | TouchEvent} e
	 */
	endDrag(e){
		if(this.origin && this.lastTranslate){
			this.carousel.enableTransition()
			if(Math.abs(this.lastTranslate.x / this.carousel.carouselWidth) > 0.2){
				if(this.lastTranslate.x < 0){
					this.carousel.next()
				}else{
					this.carousel.prev()
				}
			}else{
				this.carousel.gotoItem(this.carousel.currentItem)
			}
		}
		this.origin = null
		this.lastTranslate = null
	}
}


/**
 * Carousel class
 */
class Carousel {
	/**
	 * Constructor
	 * @param {HTMLElement} element - The DOM element wrapping the carousel
	 * @param {Object} options - Carousel options
	 */
	constructor(element , options = {}){
		this.element = element
		this.options = Object.assign({}, {
			slidesToScroll : 1,
			slidesVisible  : 1,
			loop           : false,
			pagination     : false,
			navigation     : true,
			infinite       : false,
		}, options)

		if(this.options.loop && this.options.infinite){
			throw new Error('You can not have both loop and infinity in a single carousel')
		}

		let children = Array.from(element.children)
		this.isMobile = false
		this.currentItem = 0
		this.root = this.createDivClass('carousel')
		this.container = this.createDivClass('carousel__container')
		this.root.setAttribute('tabIndex','0')
		this.element.appendChild(this.root)
		this.moveCallbacks = []
		this.offset = 0
		this.root.appendChild(this.container)

		// Wrap children in carousel items
		this.items = children.map((child) => {
			let item = this.createDivClass('carousel__item')
			item.appendChild(child)
			return item
		})

		// Infinite scroll: clone items at start and end
		if(this.options.infinite){
			this.offset = this.options.slidesVisible + this.options.slidesToScroll - 1
			if(this.offset > children.length){
				console.error("You do not have enough elements in the carousel", element)
			}
			this.items = [
				...this.items.slice(this.items.length - this.offset ).map(item => item.cloneNode(true)),
				...this.items,
				...this.items.slice(0, this.offset).map(item => item.cloneNode(true)),
			]
			this.gotoItem(this.offset, false)
		}

		// Append all items to container
		this.items.forEach(item => this.container.appendChild(item))

		// Initial setup
		this.setStyle()
		if(this.options.navigation){
			this.createNavigation()
		}
		if(this.options.pagination){
			this.createPagination()
		}

		// Call all move callbacks on init
		this.moveCallbacks.forEach(cb => cb(this.currentItem))

		// Handle screen resizing
		this.onWindowResize()
		window.addEventListener('resize', this.onWindowResize.bind(this))

		// Keyboard navigation
		this.root.addEventListener('keydown', e => {
			if(e.key === 'ArrowRight'){
				this.next()
			}else if(e.key === 'ArrowLeft'){
				this.prev()
			}
		})

		// Handle transition reset for infinite scroll
		if(this.options.infinite){
			this.container.addEventListener('transitionend', this.resetInfinite.bind(this))
		}

		// Enable touch controls
		new CarouselTouchPlugin(this)
	}

	/**
	 * Set width of container and items
	 */
	setStyle(){
		let ratio = this.items.length / this.slidesVisible
		this.container.style.width = (100 * ratio) + "%"
		this.items.forEach(item => item.style.width = (100 / this.slidesVisible / ratio) + "%")
	}

	/**
	 * Create a div with a class
	 * @param {String} className
	 * @returns {HTMLElement}
	 */
	createDivClass(className){
		let div = document.createElement('div')
		div.setAttribute('class', className)
		return div
	}

	/**
	 * Disable CSS transition
	 */
	disableTransition(){
		this.container.style.transition = 'none'
	}

	/**
	 * Enable CSS transition
	 */
	enableTransition(){
		this.container.style.transition = ''
	}

	/**
	 * Create navigation arrows
	 */
	createNavigation(){
		let nextButton = this.createDivClass('carousel__next')
		let prevButton = this.createDivClass('carousel__prev')
		this.root.appendChild(nextButton)
		this.root.appendChild(prevButton)
		nextButton.addEventListener('click', this.next.bind(this))
		prevButton.addEventListener('click', this.prev.bind(this))

		if(this.options.loop){
			return
		}

		// Show/hide arrows based on position
		this.onMove(index => {
			if(index === 0){
				prevButton.classList.add('carousel__prev--hidden')
			}else{
				prevButton.classList.remove('carousel__prev--hidden')
			}
			if(this.items[this.currentItem + this.slidesVisible] === undefined){
				nextButton.classList.add('carousel__next--hidden')
			}else{
				nextButton.classList.remove('carousel__next--hidden')
			}
		})
	}

	/**
	 * Create pagination buttons
	 */
	createPagination(){
		let pagination = this.createDivClass('carousel__pagination')
		let buttons = []
		this.root.appendChild(pagination)

		for(let i = 0 ; i < (this.items.length - 2 * this.offset) ; i += this.options.slidesToScroll){
			let button = this.createDivClass('carousel__pagination__button')
			button.addEventListener('click', () => this.gotoItem(i + this.offset))
			pagination.appendChild(button)
			buttons.push(button)
		}

		this.onMove(index => {
			let count = this.items.length - 2 * this.offset
			let activeButton = buttons[Math.floor(((index - this.offset) % count) / this.options.slidesToScroll)]
			if(activeButton){
				buttons.forEach(button => button.classList.remove('carousel__pagination__button__active'))
				activeButton.classList.add('carousel__pagination__button__active')
			}
		})
	}

	/**
	 * Translate carousel to a percentage
	 * @param {Number} percent
	 */
	translate(percent){
		this.container.style.transform = 'translate3d(' + percent + '%,0,0)'
	}

	/**
	 * Go to next slide
	 */
	next(){
		this.gotoItem(this.currentItem + this.slidesToScroll)
	}

	/**
	 * Go to previous slide
	 */
	prev(){
		this.gotoItem(this.currentItem - this.slidesToScroll)
	}

	/**
	 * Go to a specific slide
	 * @param {Number} index
	 * @param {Boolean} [animation=true]
	 */
	gotoItem(index, animation = true){
		if(index < 0){
			if(this.options.loop){
				index = this.items.length - this.slidesVisible
			}else{
				return
			}
		}else if(index >= this.items.length || (this.items[this.currentItem + this.slidesVisible] === undefined && index > this.currentItem)){
			if(this.options.loop){
				index = 0
			}else{
				return
			}
		}

		let translateX = -(index * 100 / this.items.length)
		if(animation === false){
			this.disableTransition()
		}
		this.translate(translateX)
		this.container.offsetHeight // Force layout reflow
		if(animation === false){
			this.enableTransition()
		}
		this.currentItem = index
		this.moveCallbacks.forEach(cb => cb(index))
	}

	/**
	 * Adjust carousel when at the cloned ends (infinite mode)
	 */
	resetInfinite(){
		if(this.currentItem < this.options.slidesToScroll){
			this.gotoItem(this.currentItem + (this.items.length - 2 * this.offset), false)
		}else if(this.currentItem >= this.items.length - this.offset){
			this.gotoItem(this.currentItem - (this.items.length - 2 * this.offset), false)
		}
	}

	/**
	 * Register a callback on slide move
	 * @param {Function} cb
	 */
	onMove(cb){
		this.moveCallbacks.push(cb)
	}

	/** @returns {Number} Slides to scroll (mobile responsive) */
	get slidesToScroll(){
		return this.isMobile ? 1 : this.options.slidesToScroll
	}

	/** @returns {Number} Width of the carousel container */
	get containerWidth(){
		return this.container.offsetWidth
	}

	/** @returns {Number} Slides visible at once (responsive) */
	get slidesVisible(){
		return this.isMobile ? 1 : this.options.slidesVisible
	}

	/** @returns {Number} Width of the carousel root */
	get carouselWidth(){
		return this.root.offsetWidth
	}

	/**
	 * Handle window resize and recalculate layout
	 */
	onWindowResize(){
		let mobile = window.innerWidth < 870
		if(mobile !== this.isMobile){
			this.isMobile = mobile
			this.setStyle()
			this.moveCallbacks.forEach(cb => cb(this.currentItem))
		}
	}
}

/**
 * HTML elements selection and carousel initialization
 */
document.addEventListener('DOMContentLoaded', function(){
	new Carousel(document.querySelector('#carousel1'), {
		slidesToScroll: 1,
		slidesVisible : 4,
		pagination    : true,
		loop          : true,
	})

	new Carousel(document.querySelector('#carousel2'), {
		slidesToScroll: 1,
		slidesVisible : 3,
		pagination    : true,
		infinite      : true,
	})
	
	new Carousel(document.querySelector('#carousel3'), {
		slidesToScroll: 1,
		slidesVisible : 4,
		pagination    : true,
		loop          : true,
	})
})

