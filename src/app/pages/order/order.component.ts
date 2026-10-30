import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CartService } from '../../feature/cart/cart.service';
import { BreadcrumbsComponent } from '../../feature/catalog/breadcrumbs/breadcrumbs.component';
import {
	formatModelCount,
	formatPrice,
	getProduct,
	getSeller,
	imageUrl,
} from '../../feature/catalog/catalog.data';
import { Breadcrumb } from '../../feature/catalog/catalog.interface';
import { companyProfile } from '../../feature/company/company.data';
import { ContactService } from '../../feature/contact/contact.service';

type OrderType = 'custom' | 'cart';
type SubmitState = 'idle' | 'sending' | 'sent' | 'error';

const SOFTWARE = ['Blender', '3ds Max', 'Maya', 'Unity', 'Unreal Engine', 'Веб / AR (Three.js, model-viewer)', 'Інше'];
const DEADLINES = ['Не терміново', 'Протягом тижня', '2–3 дні'];

const STEPS = [
	{
		icon: 'edit_note',
		title: 'Опишіть, що потрібно',
		text: 'Заповніть форму: моделі з кошика або опис і посилання на референси чи креслення.',
	},
	{
		icon: 'forum',
		title: "Ми зв'яжемося з вами",
		text: 'Протягом робочого дня уточнимо деталі, термін і вартість.',
	},
	{
		icon: 'deployed_code',
		title: 'Отримайте модель',
		text: 'Надішлемо архів з моделлю, текстурами й налаштованими матеріалами.',
	},
];

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
	custom: 'Модель на замовлення',
	cart: 'Моделі з кошика',
};

type TypeOption = { value: OrderType; title: string; text: string };

const TYPE_OPTIONS: TypeOption[] = [
	{ value: 'custom', title: 'Модель на замовлення', text: 'За референсами, кресленням чи описом' },
];

/**
 * Order form for a custom model or for the models in the cart (`?from=cart`).
 * Catalog models are bought through the cart; `?product=slug` adds that model to it first.
 */
@Component({
	imports: [ReactiveFormsModule, RouterLink, BreadcrumbsComponent],
	templateUrl: './order.component.html',
})
export class OrderComponent {
	private readonly _route = inject(ActivatedRoute);
	private readonly _contactService = inject(ContactService);
	private readonly _fb = inject(NonNullableFormBuilder);
	protected readonly cart = inject(CartService);

	protected readonly breadcrumbs: Breadcrumb[] = [{ label: 'Головна', path: '/' }, { label: 'Замовлення' }];
	protected readonly steps = STEPS;
	protected readonly software = SOFTWARE;
	protected readonly deadlines = DEADLINES;

	protected readonly form = this._fb.group({
		type: this._fb.control<OrderType>('custom'),
		name: this._fb.control('', [Validators.required, Validators.minLength(2)]),
		email: this._fb.control('', [Validators.required, Validators.email]),
		contact: this._fb.control(''),
		software: this._fb.control(SOFTWARE[0]!),
		deadline: this._fb.control(DEADLINES[0]!),
		budget: this._fb.control(''),
		references: this._fb.control(''),
		details: this._fb.control(''),
		consent: this._fb.control(false, Validators.requiredTrue),
	});

	private readonly _type = toSignal(this.form.controls.type.valueChanges, {
		initialValue: this.form.controls.type.value,
	});

	protected readonly isCart = computed(() => this._type() === 'cart');
	/** The cart option appears once something is in the cart (or when arriving from it). */
	protected readonly typeOptions = computed<TypeOption[]>(() =>
		this.cart.count() || this.isCart()
			? [
					...TYPE_OPTIONS,
					{ value: 'cart', title: `Кошик (${this.cart.count()})`, text: 'Моделі, які ви додали' },
				]
			: TYPE_OPTIONS,
	);
	protected readonly cartRows = computed(() =>
		this.cart.items().map((product) => ({
			product,
			thumb: imageUrl(product.images[0]!, 120),
			price: formatPrice(product.price),
		})),
	);
	protected readonly cartTotal = computed(() => formatPrice(this.cart.total()));
	protected readonly cartEmptyError = computed(() => this.isCart() && this.submitted() && !this.cart.count());

	protected readonly state = signal<SubmitState>('idle');
	protected readonly submitted = signal(false);

	constructor() {
		const query = this._route.snapshot.queryParamMap;
		const product = getProduct(query.get('product'));

		if (product) {
			this.cart.add(product.slug);
		}

		if (product || query.get('from') === 'cart') {
			this.form.patchValue({ type: 'cart' });
		}

		// A custom order needs a description; a cart order only needs contacts.
		this.form.controls.type.valueChanges
			.pipe(takeUntilDestroyed())
			.subscribe((type) => this._applyTypeValidators(type));
		this._applyTypeValidators(this.form.controls.type.value);
	}

	protected showError(name: keyof typeof this.form.controls): boolean {
		const control = this.form.controls[name];

		return control.invalid && (control.touched || this.submitted());
	}

	protected async submit() {
		this.submitted.set(true);
		this.form.markAllAsTouched();

		if (this.form.invalid || this.cartEmptyError() || this.state() === 'sending') {
			return;
		}

		this.state.set('sending');

		try {
			await this._contactService.send(this._buildMessage());
			this.state.set('sent');

			if (this.isCart()) {
				this.cart.clear();
			}
		} catch (error) {
			console.error(error);
			this.state.set('error');
		}
	}

	protected startOver() {
		this.form.reset();
		this.submitted.set(false);
		this.state.set('idle');
	}

	private _applyTypeValidators(type: OrderType) {
		const { details } = this.form.controls;

		details.setValidators(type === 'custom' ? [Validators.required, Validators.minLength(10)] : null);
		details.updateValueAndValidity({ emitEvent: false });
	}

	private _buildMessage(): string {
		const value = this.form.getRawValue();
		const lines = [
			'Нове замовлення з сайту Assetra',
			`Тип: ${ORDER_TYPE_LABELS[value.type]}`,
		];

		if (value.type === 'cart') {
			lines.push(`Кошик: ${formatModelCount(this.cart.count())}, разом ${formatPrice(this.cart.total())}`);
			this.cart.items().forEach((product, index) => {
				const seller = getSeller(product.seller)?.name ?? '—';
				lines.push(`${index + 1}. ${product.title} — ${formatPrice(product.price)} (${seller}) ${companyProfile.siteUrl}/model/${product.slug}`);
			});
		}

		lines.push(
			`Ім'я: ${value.name.trim()}`,
			`Email: ${value.email.trim()}`,
			`Телефон / Telegram: ${value.contact.trim() || '—'}`,
			`Програма: ${value.software}`,
		);

		if (value.type === 'custom') {
			lines.push(
				`Термін: ${value.deadline}`,
				`Бюджет: ${value.budget.trim() || '—'}`,
				`Креслення / фото: ${value.references.trim() || '—'}`,
			);
		}

		if (value.details.trim()) {
			lines.push('', 'Опис:', value.details.trim());
		}

		return lines.join('\n');
	}
}
