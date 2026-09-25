package com.example.banking;

import com.example.banking.models.AppUser;
import com.example.banking.models.BankAccount;
import com.example.banking.models.BankTransaction;
import com.example.banking.repositories.AppUserRepository;
import com.example.banking.repositories.BankAccountRepository;
import com.example.banking.services.BankingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class BankingDatabaseTest {

    @Autowired
    private BankingService bankingService;

    @Autowired
    private AppUserRepository users;

    @Autowired
    private BankAccountRepository accounts;

    private String email;
    private Long checkingId;
    private Long savingsId;

    @BeforeEach
    void createTestAccounts() {
        // Each test gets its own customer and accounts.
        email = "ci-" + UUID.randomUUID() + "@example.test";

        // These service tests do not log in; this is not a usable password hash.
        AppUser user = users.save(new AppUser(
                "CI Test Customer", email,
                "unused-in-service-tests", "CUSTOMER"));

        BankAccount checking = new BankAccount(user, "CHECKING");
        checking.setBalance(new BigDecimal("100.00"));
        checkingId = accounts.save(checking).getId();

        BankAccount savings = new BankAccount(user, "SAVINGS");
        savings.setBalance(new BigDecimal("50.00"));
        savingsId = accounts.save(savings).getId();
    }

    @Test
    void depositUpdatesBalanceAndSavesTransaction() {
        bankingService.deposit(
                checkingId, email, new BigDecimal("25.00"), "Test deposit");

        // Read from the database after the service transaction has committed.
        BankAccount saved = accounts.findById(checkingId).orElseThrow();
        assertEquals(new BigDecimal("125.00"), saved.getBalance());

        List<BankTransaction> history = bankingService.history(checkingId, email);
        assertEquals(1, history.size());
        assertEquals("DEPOSIT", history.get(0).getType());
        assertEquals(new BigDecimal("25.00"), history.get(0).getAmount());
        assertEquals(new BigDecimal("125.00"), history.get(0).getBalanceAfter());
    }

    @Test
    void overdraftIsRejectedWithoutChangingBalanceOrHistory() {
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> bankingService.withdraw(
                        checkingId, email, new BigDecimal("150.00"), "Too much"));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        BankAccount saved = accounts.findById(checkingId).orElseThrow();
        assertEquals(new BigDecimal("100.00"), saved.getBalance());
        assertTrue(bankingService.history(checkingId, email).isEmpty());
    }

    @Test
    void transferUpdatesBothAccountsAndSavesBothTransactions() {
        bankingService.transfer(
                email, checkingId, savingsId, new BigDecimal("30.00"));

        BankAccount checking = accounts.findById(checkingId).orElseThrow();
        BankAccount savings = accounts.findById(savingsId).orElseThrow();
        assertEquals(new BigDecimal("70.00"), checking.getBalance());
        assertEquals(new BigDecimal("80.00"), savings.getBalance());

        List<BankTransaction> outgoing = bankingService.history(checkingId, email);
        List<BankTransaction> incoming = bankingService.history(savingsId, email);
        assertEquals(1, outgoing.size());
        assertEquals(1, incoming.size());
        assertEquals("TRANSFER_OUT", outgoing.get(0).getType());
        assertEquals("TRANSFER_IN", incoming.get(0).getType());
        assertEquals(new BigDecimal("30.00"), outgoing.get(0).getAmount());
        assertEquals(new BigDecimal("30.00"), incoming.get(0).getAmount());
        assertEquals(new BigDecimal("70.00"), outgoing.get(0).getBalanceAfter());
        assertEquals(new BigDecimal("80.00"), incoming.get(0).getBalanceAfter());
        assertEquals(outgoing.get(0).getReference(), incoming.get(0).getReference());
    }
}
